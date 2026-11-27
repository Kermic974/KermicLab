export function choisirPetitPas(taches, { energie, minutes, date, exclure } = {}) {
  if (![1, 2, 3].includes(energie) || ![2, 5, 15, 30].includes(minutes)) return null;
  const aUneEtape = tache => tache.steps.some(etape => !etape.done);
  const premierPas = taches
    .filter(tache => !tache.done && tache.energy <= energie && tache.id !== exclure)
    .sort((a, b) => Number(b.priorities.includes(date)) - Number(a.priorities.includes(date)) ||
      (minutes <= 5 ? Number(aUneEtape(a)) - Number(aUneEtape(b)) : Number(aUneEtape(b)) - Number(aUneEtape(a))) ||
      (energie === 1 ? a.energy - b.energy : b.energy - a.energy))[0];
  if (!premierPas) return null;

  const etape = premierPas.steps.find(etape => !etape.done);
  return {
    tache: premierPas.id,
    etape: etape?.id ?? null,
    texte: etape?.text ?? (minutes === 2 ? 'Écrire une première mini-étape.' : 'Choisir la première mini-étape et commencer.'),
    minutes: Math.min(minutes, etape ? 15 : 5),
    raison: premierPas.priorities.includes(date)
      ? 'Cette priorité du jour correspond à ton énergie.'
      : 'Cette tâche correspond à ton énergie.'
  };
}

export function classerDecharge(texte, existants = []) {
  const connus = new Set(existants.map(normaliserTitre));
  return texte.split(/\r?\n/).map(ligne => ligne.trim()).filter(Boolean).slice(0, 20).map(ligne => {
    const prefixe = /^(idée|préoccupation|échéance|tâche)\s*:\s*(.+)$/i.exec(ligne);
    const titre = (prefixe?.[2] ?? ligne).slice(0, 500);
    const categorie = prefixe?.[1].toLocaleLowerCase('fr') ??
      (/^\d{4}-\d{2}-\d{2}\b/.test(titre) ? 'échéance' : titre.endsWith('?') ? 'préoccupation' : 'tâche');
    const cle = normaliserTitre(titre);
    const doublon = connus.has(cle);
    connus.add(cle);
    return { titre, categorie, doublon };
  });
}

export function normaliserTitre(titre) {
  return titre.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}
