import { normaliser } from "./texte.js";
import { harnessSkill } from "./configuration.js";

/** Skill du tuteur (version et prompt déclarés dans configuration.js). */
export const HARNESS_LLM = harnessSkill("tuteur");

const RELANCES = {
  fr: ["Explique plus simplement", "Donne-moi un exemple", "Propose un petit défi"],
  en: ["Explain more simply", "Give me an example", "Suggest a small challenge"]
};
const QUESTIONS_SUIVI = new Map([
  ...Object.values(RELANCES).flat(),
  "plus simplement", "un exemple", "un défi", "donne-moi un exemple concret",
  "peux-tu expliquer plus simplement ?", "more simply", "an example", "a challenge"
].map((question) => [normaliser(question), question]));

export function questionDeSuivi(message) {
  if (!/^[\p{Script=Latin}\p{M}\s?'’!,.:—-]+$/u.test(message)) return null;
  return QUESTIONS_SUIVI.get(normaliser(message)) || null;
}
export const estQuestionDeSuivi = (message) => Boolean(questionDeSuivi(message));
export const relancesContexte = (langue) => RELANCES[langue] || RELANCES.fr;

/** Extrait uniquement le texte pédagogique publié, jamais les scripts, styles ou liens du modèle. */
export function textePedagogique(html) {
  return html
    .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, (e) => ({
      "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'"
    })[e])
    .replace(/&#(x[\da-f]+|\d+);/gi, (e, n) => {
      const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/\s+/g, " ").trim().slice(0, 12000);
}

export function sourceContexte(catalogue, id, langue, origine) {
  const maquette = catalogue.index.maquettes.find((m) => m.id === id);
  if (!maquette) return null;
  const langueSource = maquette.langues.includes(langue) ? langue : "fr";
  const contenu = textePedagogique(catalogue.pages[id][langueSource]);
  if (!contenu) return null;
  return {
    id, titre: maquette.titre, version: maquette.version, langue: langueSource,
    description: `${maquette.titre} — ${maquette.sujet} · v${maquette.version}`,
    url: `${origine}/maquettes/${encodeURIComponent(id)}?lang=${langueSource}`,
    contenu
  };
}
