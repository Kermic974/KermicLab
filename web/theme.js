// Charte graphique (ADR 0026) : trois thèmes de couleurs au choix et des couleurs personnalisées.
// Module partagé : le Worker l'utilise pour valider un thème, le site pour l'appliquer. Un thème se résume à deux
// couleurs (accent et secondaire) ; les variables claires et sombres en sont dérivées avec un contraste AA garanti.

/** Thèmes proposés. « indigo » est la charte d'origine : il ne surcharge aucune variable de style.css. */
export const THEMES = Object.freeze({
  indigo: Object.freeze({ libelle: "Indigo", accent: "#3d4fd6", secondaire: "#6c43d0" }),
  lagon: Object.freeze({ libelle: "Lagon", accent: "#0e7c86", secondaire: "#2563c9" }),
  bougainvillier: Object.freeze({ libelle: "Bougainvillier", accent: "#b0256f", secondaire: "#6c43d0" })
});
export const THEME_PAR_DEFAUT = "indigo";
export const THEME_PERSONNALISE = "personnalise";
/** Contraste minimal (WCAG AA, texte courant). */
export const CONTRASTE_MIN = 4.5;

const HEX = /^#[0-9a-f]{6}$/;
const FONDS = { clair: { surface: "#ffffff", texte: "#ffffff" }, sombre: { surface: "#161a30", texte: "#0d0f1f" } };

const versRvb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const versHex = (rvb) => `#${rvb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

function versTsl(hex) {
  const [r, v, b] = versRvb(hex).map((c) => c / 255);
  const max = Math.max(r, v, b), min = Math.min(r, v, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const t = max === r ? ((v - b) / d) % 6 : max === v ? (b - r) / d + 2 : (r - v) / d + 4;
  return [(t * 60 + 360) % 360, s, l];
}

function deTsl(t, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((t / 60) % 2) - 1)), m = l - c / 2;
  const [r, v, b] = t < 60 ? [c, x, 0] : t < 120 ? [x, c, 0] : t < 180 ? [0, c, x] : t < 240 ? [0, x, c] : t < 300 ? [x, 0, c] : [c, 0, x];
  return versHex([r, v, b].map((k) => (k + m) * 255));
}

function luminance(hex) {
  const [r, v, b] = versRvb(hex).map((c) => { const k = c / 255; return k <= 0.03928 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
export function contraste(a, b) {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

/** Assombrit (`sens` -1) ou éclaircit (+1) une couleur par pas de 1 % jusqu'au contraste minimal avec `fond`. */
function ajuster(hex, fond, sens) {
  let [t, s, l] = versTsl(hex);
  let couleur = hex;
  for (let i = 0; i < 100 && contraste(couleur, fond) < CONTRASTE_MIN; i += 1) {
    l = Math.max(0, Math.min(1, l + sens * 0.01));
    couleur = deTsl(t, s, l);
  }
  return couleur;
}

const decaler = (hex, delta) => { const [t, s, l] = versTsl(hex); return deTsl(t, s, Math.max(0, Math.min(1, l + delta))); };
const teinte = (hex, s, l) => { const [t, sat] = versTsl(hex); return deTsl(t, Math.min(sat, s), l); };

/** Variables CSS dérivées de deux couleurs, pour le mode clair et le mode sombre. Fonction pure. */
export function deriverVariables({ accent, secondaire }) {
  const clairAccent = ajuster(accent, FONDS.clair.surface, -1);
  const clairDoux = teinte(accent, 0.7, 0.95);
  const clairLab = ajuster(secondaire, FONDS.clair.surface, -1);
  const sombreAccent = ajuster(decaler(accent, 0.2), FONDS.sombre.surface, 1);
  const sombreDoux = teinte(accent, 0.4, 0.23);
  const sombreBulle = ajuster(teinte(accent, 0.5, 0.44), "#f3f5ff", -1);
  return {
    clair: {
      accent: clairAccent, "accent-texte": "#ffffff", "accent-fort": decaler(clairAccent, -0.08),
      "accent-doux": clairDoux, "accent-doux-texte": ajuster(decaler(clairAccent, -0.08), clairDoux, -1),
      "bulle-moi": clairAccent, "bulle-moi-texte": "#ffffff",
      lab: clairLab, "lab-doux": teinte(secondaire, 0.6, 0.96), "lab-bord": teinte(secondaire, 0.6, 0.9)
    },
    sombre: {
      accent: sombreAccent, "accent-texte": FONDS.sombre.texte, "accent-fort": decaler(sombreAccent, 0.06),
      "accent-doux": sombreDoux, "accent-doux-texte": ajuster(teinte(accent, 0.8, 0.85), sombreDoux, 1),
      "bulle-moi": sombreBulle, "bulle-moi-texte": "#f3f5ff",
      lab: ajuster(decaler(secondaire, 0.2), FONDS.sombre.surface, 1), "lab-doux": teinte(secondaire, 0.38, 0.18), "lab-bord": teinte(secondaire, 0.37, 0.29)
    }
  };
}

/**
 * Valide un thème saisi dans le back-office : identifiant d'un thème proposé, ou « personnalise » avec deux couleurs.
 * @returns {{ ok: true, theme: { id: string, accent?: string, secondaire?: string } } | { ok: false, code: string }}
 */
export function validerTheme(corps) {
  const id = String(corps?.id ?? "");
  if (Object.hasOwn(THEMES, id)) return { ok: true, theme: { id } };
  if (id !== THEME_PERSONNALISE) return { ok: false, code: "theme-inconnu" };
  const accent = String(corps?.accent ?? "").toLowerCase(), secondaire = String(corps?.secondaire ?? "").toLowerCase();
  if (!HEX.test(accent) || !HEX.test(secondaire)) return { ok: false, code: "couleur-invalide" };
  return { ok: true, theme: { id, accent, secondaire } };
}

/** Couleurs de base d'un thème valide (proposé ou personnalisé). */
export const couleursTheme = (theme) => (theme?.id === THEME_PERSONNALISE
  ? { accent: theme.accent, secondaire: theme.secondaire }
  : { accent: (THEMES[theme?.id] ?? THEMES[THEME_PAR_DEFAUT]).accent, secondaire: (THEMES[theme?.id] ?? THEMES[THEME_PAR_DEFAUT]).secondaire });

/** Feuille de style d'un thème (chaîne vide pour la charte d'origine) : mêmes sélecteurs que style.css. */
export function cssTheme(theme) {
  if (!theme || theme.id === THEME_PAR_DEFAUT || (theme.id !== THEME_PERSONNALISE && !Object.hasOwn(THEMES, theme.id))) return "";
  const { clair, sombre } = deriverVariables(couleursTheme(theme));
  const bloc = (variables) => Object.entries(variables).map(([nom, valeur]) => `--${nom}: ${valeur};`).join(" ");
  return [
    `:root { ${bloc(clair)} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${bloc(sombre)} } }`,
    `:root[data-theme="dark"] { ${bloc(sombre)} }`
  ].join("\n");
}

/** Applique un thème à un document (feuille construite : compatible avec la CSP `style-src 'self'`). */
export function appliquerTheme(theme, doc = document) {
  const css = cssTheme(theme);
  const feuilles = doc.adoptedStyleSheets.filter((f) => !f.kermiclabTheme);
  if (css) {
    const feuille = new (doc.defaultView ?? window).CSSStyleSheet();
    feuille.replaceSync(css);
    feuille.kermiclabTheme = true;
    feuilles.push(feuille);
  }
  doc.adoptedStyleSheets = feuilles;
}
