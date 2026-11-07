// Origines autorisées à afficher une page du catalogue (ADR 0025) : celles de ORIGINES_AUTORISEES, déjà utilisées pour
// l'en-tête frame-ancestors. Elles sont écrites dans les métadonnées servies (`allowedParentOrigins`) pour que les ponts
// des pages (événements pédagogiques, trophées) ne parlent qu'à ces parents, même si la page était réhébergée ailleurs.
// Le bloc <script type="application/json" id="kermiclab-meta"> est une donnée : il n'entre pas dans les hashes CSP.

/** Origines http(s) valides et exactes de la variable ORIGINES_AUTORISEES (sans « * » ni chemin). */
export function originesParent(env) {
  const origines = [];
  for (const brut of String(env?.ORIGINES_AUTORISEES ?? "").split(",").map((s) => s.trim())) {
    try {
      const u = new URL(brut);
      if (["https:", "http:"].includes(u.protocol) && u.origin === brut && !origines.includes(brut)) origines.push(brut);
    } catch { /* entrée ignorée */ }
  }
  return origines;
}

/** Ajoute `allowedParentOrigins` aux métadonnées d'une page servie ; la page est rendue telle quelle sinon. */
export function injecterOriginesParent(html, origines) {
  if (!origines.length) return html;
  const motif = /(<script type="application\/json" id="kermiclab-meta">)([\s\S]*?)(<\/script>)/;
  const trouve = html.match(motif);
  if (!trouve) return html;
  let meta;
  try { meta = JSON.parse(trouve[2]); } catch { return html; }
  const texte = JSON.stringify({ ...meta, allowedParentOrigins: origines }, null, 2).replace(/</g, "\\u003c");
  return html.replace(motif, (_, debut, __, fin) => `${debut}\n${texte}\n${fin}`);
}
