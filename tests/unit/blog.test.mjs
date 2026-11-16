// Blog (issue #277) : en-tête, conversion Markdown sûre, pages générées, exclusion des articles non validés.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AUTEURS, articlesPublies, construireBlog, estProgramme, jourDePublication, echapper, enLigne, lireArticle, lireEntete, markdownEnHtml,
  pageArticle, pageAuteurs, pageListe, retirerTitreDouble, slugDepuisFichier, validerEntete
} from "../../scripts/lib/blog.mjs";

const racine = new URL("../../", import.meta.url).pathname;
const article = (entete, corps = "Texte.") => `---\n${Object.entries(entete).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n${corps}\n`;
const VALIDE = { titre: '"Un titre"', auteur: '"Chloé Grok, rédactrice en chef (assistante IA)"', date: "2026-11-16", statut: "validé" };

test("en-tête : champs, guillemets, apostrophes, jour et resume facultatifs", () => {
  const { entete, corps } = lireEntete(article({ ...VALIDE, jour: "J1", resume: "'L''école, vue de près'" }, "# Corps"));
  assert.equal(entete.titre, "Un titre");
  assert.equal(entete.auteur, "Chloé Grok, rédactrice en chef (assistante IA)");
  assert.equal(entete.date, "2026-11-16");
  assert.equal(entete.statut, "validé");
  assert.equal(entete.jour, "J1");
  assert.equal(entete.resume, "L'école, vue de près");
  assert.equal(corps.trim(), "# Corps");
  assert.throws(() => lireEntete("# Sans en-tête"), /en-tête/);
  assert.throws(() => lireEntete("---\nligne sans deux-points\n---\n"), /illisible/);
});

test("en-tête : statut « validé » écrit en Unicode décomposé reste reconnu", () => {
  const a = lireArticle(article({ ...VALIDE, statut: "valide\u0301" }), "2026-11-16-x.md");
  assert.equal(a.publie, true);
});

test("validation : champs obligatoires et date AAAA-MM-JJ", () => {
  assert.doesNotThrow(() => validerEntete({ titre: "t", auteur: "a", date: "2026-02-28", statut: "validé" }));
  assert.throws(() => validerEntete({ titre: "t", date: "2026-11-16", statut: "validé" }), /auteur/);
  for (const date of ["16/11/2026", "2026-02-30", "2026-13-01", "2026-1-5"]) {
    assert.throws(() => validerEntete({ titre: "t", auteur: "a", date, statut: "validé" }), /date/);
  }
  assert.throws(() => lireArticle(article({ ...VALIDE, date: "demain" }), "a.md"), /date/);
});

test("adresse : nom de fichier en minuscules, chiffres et tirets ; « auteurs » réservé", () => {
  assert.equal(slugDepuisFichier("blog/2026-11-16-pourquoi-kermiclab.md"), "2026-11-16-pourquoi-kermiclab");
  for (const nom of ["Article.md", "mon article.md", "a_b.md", "é.md", "auteurs.md"]) assert.throws(() => slugDepuisFichier(nom));
});

test("échappement : aucune balise HTML de l'article n'est interprétée", () => {
  assert.equal(echapper(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  const html = markdownEnHtml(`<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n# <b>titre</b>\n\n- <i>x</i>`);
  // Test sans expression régulière sur les balises (alerte CodeQL js/bad-tag-filter) : comparaison en minuscules.
  for (const balise of ["<script", "<img", "<b>", "<i>"]) assert.ok(!html.toLowerCase().includes(balise), balise);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("liens : adresses sûres seulement, attributs échappés", () => {
  assert.equal(enLigne("[site](https://www.kermiclab.online)"), '<a href="https://www.kermiclab.online" rel="noopener">site</a>');
  assert.equal(enLigne("[auteurs](/blog/auteurs/)"), '<a href="/blog/auteurs/">auteurs</a>');
  assert.equal(enLigne("[x](javascript:alert(1))"), "x)");
  assert.equal(enLigne("[x](data:text/html,1)"), "x");
  assert.equal(enLigne('[x](https://a.b/?q="><script>)'), '<a href="https://a.b/?q=&quot;&gt;&lt;script&gt;" rel="noopener">x</a>');
  assert.equal(enLigne("[x](https://a.b/_c_/d*e*)"), '<a href="https://a.b/_c_/d*e*" rel="noopener">x</a>', "l'adresse n'est pas mise en forme");
});

test("en ligne : gras, italique, code (dont le code n'est pas mis en forme)", () => {
  assert.equal(enLigne("**gras** et *italique* et _aussi_"), "<strong>gras</strong> et <em>italique</em> et <em>aussi</em>");
  assert.equal(enLigne("`a <b> **c**`"), "<code>a &lt;b&gt; **c**</code>");
  assert.equal(enLigne("nom_de_variable"), "nom_de_variable");
  assert.equal(enLigne("[**lien gras**](/blog/)"), '<a href="/blog/"><strong>lien gras</strong></a>');
});

test("blocs : titres, paragraphes, listes, citations, code, séparateur", () => {
  const html = markdownEnHtml("## Partie\n\nUne ligne\nsuite.\n\n- un\n- deux\n\n1. premier\n2. second\n\n> cité\n\n```\n<x> **y**\n```\n\n---");
  assert.equal(html, [
    "<h2>Partie</h2>", "<p>Une ligne suite.</p>", "<ul>\n<li>un</li>\n<li>deux</li>\n</ul>",
    "<ol>\n<li>premier</li>\n<li>second</li>\n</ol>", "<blockquote><p>cité</p></blockquote>",
    "<pre><code>&lt;x&gt; **y**</code></pre>", "<hr>"
  ].join("\n"));
  assert.equal(markdownEnHtml("# A\n## B\n###### C", { decalage: 1 }), "<h2>A</h2>\n<h3>B</h3>\n<h6>C</h6>");
});

test("titre en double : le h1 du texte identique au titre n'est pas répété", () => {
  assert.equal(retirerTitreDouble("# Pourquoi KermicLab existe\n\nTexte", "Pourquoi KermicLab existe").trim(), "Texte");
  assert.equal(retirerTitreDouble("# Autre titre\n\nTexte", "Pourquoi").trim(), "# Autre titre\n\nTexte");
  const html = pageArticle(lireArticle(article(VALIDE, "# Un titre\n\nIntro.\n\n## Partie"), "2026-11-16-x.md"));
  assert.equal(html.match(/<h1>/g).length, 1);
  assert.match(html, /<h2>Partie<\/h2>/, "les intertitres ## restent des h2 sous le h1");
  const autreH1 = pageArticle(lireArticle(article(VALIDE, "# Autre\n\n## Partie"), "2026-11-16-x.md"));
  assert.equal(autreH1.match(/<h1>/g).length, 1, "un autre # du texte descend en h2");
  assert.match(autreH1, /<h2>Autre<\/h2>\n<h3>Partie<\/h3>/);
});

test("pages : lang fr, un seul h1, mention « Auteur IA », aucun script ni style en ligne ni ressource externe", () => {
  const a = lireArticle(article({ ...VALIDE, jour: "J1" }, "Bonjour."), "2026-11-16-x.md");
  for (const html of [pageArticle(a), pageListe([a]), pageAuteurs()]) {
    assert.match(html, /<html lang="fr">/);
    assert.equal(html.match(/<h1>/g).length, 1);
    assert.doesNotMatch(html, /<script|<style|\sstyle=|\son[a-z]+=/i);
    assert.doesNotMatch(html, /<(link|img|iframe)\b[^>]*\s(href|src)="(https?:)?\/\//i);
    assert.match(html, /assistants? IA/);
  }
  assert.match(pageArticle(a), /<strong>Auteur IA<\/strong> : Chloé Grok, rédactrice en chef \(assistante IA\)/);
  assert.match(pageArticle(a), /<p class="blog-jour">J1<\/p>/);
  assert.match(pageListe([a]), /<strong>Auteur IA<\/strong>/);
  assert.match(pageListe([a]), /href="\/blog\/2026-11-16-x\/"/);
});

test("page auteurs : les six agents, assistants IA supervisés par Mickael Kerbidi", () => {
  const html = pageAuteurs();
  assert.deepEqual(AUTEURS.map((a) => a.nom.split(" ")[0]).sort(), ["Chloé", "Hugo", "Inès", "Manon", "Paul", "Émile"].sort());
  for (const { nom } of AUTEURS) assert.match(html, new RegExp(`${nom}</strong> \\(assistante? IA\\)`));
  assert.match(html, /Tous les auteurs de ce blog sont des assistants IA/);
  assert.match(html, /Mickael Kerbidi/);
  assert.match(html, /fusionne/);
});

test("liste : seuls les articles validés, du plus récent au plus ancien", () => {
  const lire = (nom, entete) => lireArticle(article(entete), nom);
  const articles = [
    lire("2026-11-16-a.md", { ...VALIDE, titre: "A" }),
    lire("2026-11-17-b.md", { ...VALIDE, titre: "B", date: "2026-11-17" }),
    lire("2026-11-18-c.md", { titre: "C", statut: "brouillon" }),
    lire("2026-11-19-d.md", { titre: "D", statut: "publié", auteur: "x", date: "2026-11-19" })
  ];
  assert.deepEqual(articlesPublies(articles).map((a) => a.titre), ["B", "A"]);
  const html = pageListe(articles);
  assert.doesNotMatch(html, />C<|>D</);
  assert.ok(html.indexOf(">B<") < html.indexOf(">A<"));
  assert.match(pageListe([]), /Aucun article publié/);
});

test("construction : brouillons hors de dist, README ignoré, une page par article", async () => {
  const dossier = await mkdtemp(path.join(tmpdir(), "blog-"));
  const sortie = path.join(dossier, "dist");
  try {
    await writeFile(path.join(dossier, "README.md"), "# Pas un article");
    await writeFile(path.join(dossier, "2026-11-16-publie.md"), article(VALIDE, "Publié."));
    await writeFile(path.join(dossier, "2026-11-17-brouillon.md"), article({ ...VALIDE, statut: "brouillon" }, "SECRET-BROUILLON"));
    const resultat = await construireBlog(dossier, sortie, { feuilleDeStyle: "body{}" });
    assert.deepEqual(resultat, { publies: ["2026-11-16-publie"], programmes: [], ignores: ["2026-11-17-brouillon"] });
    assert.deepEqual((await readdir(sortie)).sort(), ["2026-11-16-publie", "auteurs", "blog.css", "index.html"]);
    const liste = await readFile(path.join(sortie, "index.html"), "utf8");
    assert.doesNotMatch(liste, /brouillon/);
    assert.match(liste, /href="\/blog\/blog\.css\?v=[a-f0-9]{10}"/);
    assert.match(await readFile(path.join(sortie, "2026-11-16-publie", "index.html"), "utf8"), /<p>Publié\.<\/p>/);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
});

test("publication programmée : jour de La Réunion, ou jour imposé pour un build reproductible", () => {
  // 20:30 UTC le 16 : il est déjà 00:30 le 17 à La Réunion (UTC+4).
  assert.equal(jourDePublication(new Date("2026-11-16T20:30:00Z"), {}), "2026-11-17");
  assert.equal(jourDePublication(new Date("2026-11-16T19:59:00Z"), {}), "2026-11-16");
  assert.equal(jourDePublication(new Date("2026-11-16T20:30:00Z"), { KERMICLAB_BLOG_JOUR: "2026-12-01" }), "2026-12-01");
  assert.throws(() => jourDePublication(new Date(), { KERMICLAB_BLOG_JOUR: "demain" }), /KERMICLAB_BLOG_JOUR invalide/);
});

test("publication programmée : un article validé daté dans le futur attend sa date, sans jour tout est publié", () => {
  const lire = (nom, entete) => lireArticle(article(entete), nom);
  const articles = [
    lire("2026-11-16-a.md", { ...VALIDE, titre: "A" }),
    lire("2026-11-17-b.md", { ...VALIDE, titre: "B", date: "2026-11-17" }),
    lire("2026-11-22-c.md", { ...VALIDE, titre: "C", date: "2026-11-22" }),
    lire("2026-11-30-d.md", { ...VALIDE, titre: "D", date: "2026-11-30", statut: "brouillon" })
  ];
  assert.deepEqual(articlesPublies(articles, { jour: "2026-11-16" }).map((a) => a.titre), ["A"]);
  assert.deepEqual(articlesPublies(articles, { jour: "2026-11-17" }).map((a) => a.titre), ["B", "A"], "publié le jour même");
  assert.deepEqual(articlesPublies(articles, { jour: "2026-12-01" }).map((a) => a.titre), ["C", "B", "A"], "un brouillon ne sort jamais");
  assert.deepEqual(articlesPublies(articles).map((a) => a.titre), ["C", "B", "A"]);
  assert.equal(estProgramme(articles[2], "2026-11-21"), true);
  assert.equal(estProgramme(articles[3], "2026-11-21"), false, "un brouillon n'est pas programmé : il est ignoré");
});

test("publication programmée : l'article en attente n'est écrit nulle part dans le site construit", async () => {
  const dossier = await mkdtemp(path.join(tmpdir(), "blog-programme-"));
  const sortie = path.join(dossier, "dist");
  try {
    await writeFile(path.join(dossier, "2026-11-16-publie.md"), article(VALIDE, "Publié."));
    await writeFile(path.join(dossier, "2026-11-22-attente.md"), article({ ...VALIDE, titre: "TITRE-EN-ATTENTE", date: "2026-11-22" }, "TEXTE-EN-ATTENTE"));
    const avant = await construireBlog(dossier, sortie, { feuilleDeStyle: "body{}", jour: "2026-11-21" });
    assert.deepEqual(avant, { publies: ["2026-11-16-publie"], programmes: ["2026-11-22-attente"], ignores: [] });
    assert.deepEqual((await readdir(sortie)).sort(), ["2026-11-16-publie", "auteurs", "blog.css", "index.html"]);
    assert.doesNotMatch(await readFile(path.join(sortie, "index.html"), "utf8"), /EN-ATTENTE|2026-11-22/);
    const apres = await construireBlog(dossier, sortie, { feuilleDeStyle: "body{}", jour: "2026-11-22" });
    assert.deepEqual(apres.publies, ["2026-11-22-attente", "2026-11-16-publie"]);
    assert.match(await readFile(path.join(sortie, "2026-11-22-attente", "index.html"), "utf8"), /TEXTE-EN-ATTENTE/);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
});

test("dépôt : les articles de blog/ sont lisibles et l'article de test est publié", async () => {
  const dossier = await mkdtemp(path.join(tmpdir(), "blog-depot-"));
  try {
    const { publies } = await construireBlog(path.join(racine, "blog"), dossier);
    assert.ok(publies.includes("2026-11-16-bienvenue-sur-le-blog"));
    for (const slug of publies) {
      const html = await readFile(path.join(dossier, slug, "index.html"), "utf8");
      assert.equal(html.match(/<h1>/g).length, 1, slug);
      assert.match(html, /<strong>Auteur IA<\/strong>/, slug);
    }
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
});
