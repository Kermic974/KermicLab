// Analyse d'une requête ou d'un contenu avant tout traitement (ADR 0026) : catégories seulement, jamais de texte.
// Fonction pure : le texte analysé n'est ni renvoyé, ni journalisé, ni stocké. Les compteurs par catégorie alimentent
// la télémétrie de sécurité (signaux_securite) et l'analyse comportementale (comportement.js).
import { normaliser } from "./texte.js";
import { pseudonymiser } from "./pseudonymisation.js";
import { donneesPersonnelles } from "./moderation.js";

/** Catégories de signal, dans l'ordre d'affichage du back-office. */
export const CATEGORIES = Object.freeze([
  "donnees-personnelles", "sexuel", "contenu-dangereux", "detresse", "injection-directe", "injection-indirecte"
]);

const SEXUEL = ["porno", "pornographie", "pornographique", "porn", "sexe", "sexuel", "sexuelle", "sex", "sexting", "nude", "nudes", "erotique", "xxx"];
const DANGEREUX = ["drogue", "cocaine", "heroine", "fabriquer une bombe", "arme a feu", "acheter une arme", "explosif", "make a bomb", "buy a gun"];
const DETRESSE = ["suicide", "me suicider", "me tuer", "envie de mourir", "me faire du mal", "kill myself", "hurt myself", "want to die"];

/**
 * Injection directe : l'auteur demande au modèle d'abandonner ses consignes ou de les révéler.
 * Motifs appliqués au texte normalisé (minuscules, sans accents ni ponctuation).
 */
const INJECTION_DIRECTE = [
  // Le verbe doit viser les consignes du modèle (« tes », « précédentes », « all previous »…) : « j'oublie toujours
  // les règles de conjugaison » ou « montre-moi les règles des échecs » ne sont pas des injections.
  ["annulation-consignes", /\b(ignore[sz]?|ignorer|oublie[sz]?|oublier|disregard|forget|override|contourne[rsz]?|bypass)\b.{0,30}\b(tes|ton|vos|votre|your|all|toutes|tous|previous|prior|above|precedent[a-z]*)\b.{0,30}\b(instruction|instructions|consigne|consignes|regle|regles|rules|prompt|filtre|filtres|securite|safety|limites|restrictions)\b/],
  ["annulation-consignes", /\b(ignore[sz]?|ignorer|oublie[sz]?|oublier|disregard|forget|override|contourne[rsz]?|bypass)\b.{0,30}\b(instruction|instructions|consigne|consignes|regle|regles|rules|prompt)\b.{0,20}\b(precedent[a-z]*|ci dessus|above|previous|prior|de securite|du systeme|system)\b/],
  ["nouvelles-consignes", /\b(nouvelles instructions|nouvelles consignes|new instructions|a partir de maintenant tu|from now on you)\b/],
  ["prompt-systeme", /\b(system prompt|prompt systeme|message systeme|instructions systeme|developer message|message developpeur|initial prompt|prompt initial)\b/],
  ["revelation-consignes", /\b(revele[sz]?|reveler|montre[sz]?|affiche[sz]?|repete[sz]?|recite[sz]?|reveal|show|print|repeat|leak)\b.{0,30}\b(ton|tes|vos|votre|your|du systeme|the system)\b.{0,20}\b(prompt|instructions|consignes)\b/],
  ["debridage", /\b(jailbreak|do anything now|mode dan|dan mode|mode developpeur|developer mode|sans restriction|sans restrictions|sans filtre|sans censure|no restrictions|unfiltered|uncensored)\b/],
  ["changement-identite", /\b(tu n es plus|you are no longer|tu es maintenant|tu es desormais|you are now)\b.{0,40}\b(assistant|kermiclab|ia|ai|modele|model|bot|chatbot)\b/]
];

/**
 * Injection indirecte : instructions dissimulées dans une donnée (balisage de rôle, caractères invisibles, charge
 * encodée, exfiltration par lien ou image, adresse au modèle lecteur). Motifs appliqués au texte brut.
 */
const INJECTION_INDIRECTE = [
  ["balise-role", /<\/?\s*(system|assistant|developer|instructions?)\s*>|\[\/?\s*(INST|SYS|SYSTEM)\s*\]|<\|[a-z_]{2,20}\|>|^\s{0,3}#{1,6}\s*(system|instructions?)\b|\brole\s*[:=]\s*["']?(system|assistant|developer)\b/im],
  ["caracteres-invisibles", /[​-‏‪-‮⁠-⁩﻿]|[\u{e0000}-\u{e007f}]/u],
  ["charge-encodee", /(?:[A-Za-z0-9+/]{40,}={0,2})|(?:\b[0-9a-fA-F]{48,}\b)/],
  ["balisage-actif", /<\s*(script|iframe|img|object|embed|link|meta)\b|<!--|javascript:|data:text\/html/i],
  ["exfiltration-lien", /!\[[^\]]{0,200}\]\(\s*https?:/i],
  ["adresse-au-modele", /\b(si tu es une? (?:ia|assistant|modele)|if you are an? (?:ai|assistant|llm|language model)|a l['’ ]attention de l['’ ](?:ia|assistant)|note (?:to|for) the (?:ai|assistant|model|llm)|when you read this|lorsque tu liras ceci|quand tu liras ceci)\b/i]
];

const contient = (normalise, liste) => {
  const entoure = ` ${normalise} `;
  return liste.some((mot) => entoure.includes(` ${mot} `));
};

/**
 * @param {unknown} texte texte d'une requête (`origine: "utilisateur"`) ou d'un contenu destiné au catalogue ou à un
 *   prompt (`origine: "contenu"`).
 * @returns {{ categories: string[], motifs: string[], donneesPersonnelles: Record<string, number>, taille: number }}
 *   `motifs` : identifiants des règles déclenchées (jamais un extrait du texte).
 */
export function analyserRequete(texte, { origine = "utilisateur" } = {}) {
  const brut = String(texte ?? "");
  const n = normaliser(brut);
  const categories = new Set();
  const motifs = [];

  const { remplacements, total } = pseudonymiser(brut);
  const identite = donneesPersonnelles(brut);
  const personnelles = { ...remplacements };
  if (identite && !total) personnelles[identite.toUpperCase()] = 1;
  if (total || identite) categories.add("donnees-personnelles");

  if (contient(n, SEXUEL)) categories.add("sexuel");
  if (contient(n, DANGEREUX)) categories.add("contenu-dangereux");
  if (contient(n, DETRESSE)) categories.add("detresse");

  for (const [id, motif] of INJECTION_DIRECTE) {
    if (!motif.test(n)) continue;
    // Dans un contenu, une consigne adressée au modèle est une injection indirecte : son auteur n'est pas l'utilisateur.
    categories.add(origine === "contenu" ? "injection-indirecte" : "injection-directe");
    if (!motifs.includes(id)) motifs.push(id);
  }
  for (const [id, motif] of INJECTION_INDIRECTE) {
    if (!motif.test(brut)) continue;
    categories.add("injection-indirecte");
    motifs.push(id);
  }
  return {
    categories: CATEGORIES.filter((c) => categories.has(c)),
    motifs,
    donneesPersonnelles: personnelles,
    taille: brut.length
  };
}
