/**
 * Limitation de débit par IP (niveau 0) : fenêtre fixe d'une minute, en mémoire de l'isolat.
 * Approximative (un compteur par isolat) mais sans stockage d'IP. Niveau 1 : binding
 * Cloudflare Rate Limiting (voir docs/chantiers/securite.md).
 */
export function creerLimiteur({ maxParMinute, maintenant = () => Date.now() }) {
  const compteurs = new Map();
  return function autoriser(cle) {
    const t = maintenant();
    const fenetre = Math.floor(t / 60000);
    const c = compteurs.get(cle);
    if (!c || c.fenetre !== fenetre) {
      if (compteurs.size > 10000) compteurs.clear();
      compteurs.set(cle, { fenetre, n: 1 });
      return true;
    }
    c.n += 1;
    return c.n <= maxParMinute;
  };
}
