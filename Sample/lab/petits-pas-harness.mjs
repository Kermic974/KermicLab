// Harness local, lecture seule. Les titres restent dans le navigateur.
export const HARNESS_PETITS_PAS = Object.freeze({ nom: "petits-pas", version: "0.1.0" });

export function proposerPlan({ tasks = [], energie = 2 } = {}) {
  if (!Array.isArray(tasks) || tasks.length > 100 || ![1, 2, 3].includes(energie)) {
    throw new TypeError("Contexte invalide");
  }
  const ids = new Set();
  const disponibles = [];
  for (const t of tasks) {
    if (!t || typeof t.id !== "string" || !t.id || t.id.length > 128 ||
        ids.has(t.id) || ![1, 2, 3].includes(t.energy)) {
      throw new TypeError("Tâche invalide");
    }
    ids.add(t.id);
    if (!t.done && t.energy <= energie) disponibles.push(t);
  }
  disponibles.sort((a, b) => energie === 1 ? a.energy - b.energy : b.energy - a.energy);
  return {
    harness: HARNESS_PETITS_PAS.version,
    propositions: disponibles.slice(0, energie === 1 ? 1 : 3).map(t => ({
      action: "proposer_priorite",
      taskId: t.id,
      raison: "Compatible avec ton énergie déclarée.",
      premierPas: "Choisir une petite étape et essayer cinq minutes."
    }))
  };
}
