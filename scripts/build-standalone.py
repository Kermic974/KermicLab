"""Assemble src/ en un seul index.html autonome (aucune dépendance).

Usage :
  python3 scripts/build-standalone.py            écrit index.html
  python3 scripts/build-standalone.py --check    échoue si index.html n'est pas à jour
  python3 scripts/build-standalone.py --dev      écrit src/dev.html (modules ES, serveur local requis)
  python3 scripts/build-standalone.py --out F    écrit le livrable dans F (archive de version)

Conventions imposées aux modules (voir AGENTS.md) :
  - import { a, b } from './x.js';            imports nommés, chemins relatifs, sans alias
  - export function / const / let / var / class   exports nommés, pas d'export default
  - export { a, b } from './x.js';            réexportations (src/api.js)
  - déclarations de niveau module en colonne 0 et noms uniques dans tout src/
  - aucune dépendance circulaire
"""
import re
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
ENTRY = SRC / "ui" / "main.js"
TEMPLATE = SRC / "index.template.html"
CSS = SRC / "styles" / "app.css"
OUT = ROOT / "index.html"
DEV = SRC / "dev.html"

IMPORT = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*'([^']+)';[ \t]*\n?", re.M)
REEXPORT = re.compile(r"^export\s*\{([^}]*)\}\s*from\s*'([^']+)';[ \t]*\n?", re.M)
DECL = re.compile(r"^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)", re.M)
EXPORT_DECL = re.compile(r"^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)", re.M)
BANNER = "<!-- Fichier généré par scripts/build-standalone.py depuis src/ : ne pas modifier à la main. -->\n"


class BuildError(Exception):
    pass


def rel(p):
    return p.relative_to(ROOT).as_posix()


def names(group, where):
    out = [n.strip() for n in group.replace("\n", " ").split(",") if n.strip()]
    for n in out:
        if not re.fullmatch(r"[A-Za-z_$][\w$]*", n):
            raise BuildError(f"{where} : nom non supporté « {n} » (pas d'alias ni de *)")
    return out


def parse(path):
    text = path.read_text(encoding="utf-8")
    deps = []
    for rx in (IMPORT, REEXPORT):
        for m in rx.finditer(text):
            target = (path.parent / m.group(2)).resolve()
            if SRC not in target.parents or not target.is_file():
                raise BuildError(f"{rel(path)} : module introuvable « {m.group(2)} »")
            deps.append((target, names(m.group(1), rel(path)), rx is REEXPORT))
    body = REEXPORT.sub("", IMPORT.sub("", text))
    for bad, why in ((r"^\s*import\b", "import non supporté"), (r"^\s*export\s+default\b", "export default interdit"),
                     (r"^\s*export\s*\*", "export * interdit"), (r"^\s*export\s*\{", "export { } sans from interdit")):
        m = re.search(bad, body, re.M)
        if m:
            line = text[:text.find(m.group(0).strip())].count("\n") + 1
            raise BuildError(f"{rel(path)}:{line} : {why}")
    decls = DECL.findall(body)
    exports = set(re.findall(r"^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)", body, re.M))
    exports |= {n for _, ns, re_export in deps if re_export for n in ns}
    return {"path": path, "deps": deps, "decls": decls, "exports": exports, "body": EXPORT_DECL.sub("", body)}


def collect(entry):
    modules, order, state = {}, [], {}

    def visit(path, chain):
        if state.get(path) == "done":
            return
        if state.get(path) == "visiting":
            cycle = chain[chain.index(path):] + [path]
            raise BuildError("dépendance circulaire : " + " → ".join(rel(p) for p in cycle))
        state[path] = "visiting"
        mod = modules[path] = parse(path)
        for dep, _, _ in mod["deps"]:
            visit(dep, chain + [path])
        state[path] = "done"
        order.append(mod)

    visit(entry.resolve(), [])
    for mod in order:
        for dep, ns, _ in mod["deps"]:
            missing = [n for n in ns if n not in modules[dep]["exports"]]
            if missing:
                raise BuildError(f"{rel(mod['path'])} : « {', '.join(missing)} » non exporté par {rel(dep)}")
    seen = {}
    for mod in order:
        for n in mod["decls"]:
            if n in seen:
                raise BuildError(f"nom « {n} » déclaré dans {rel(seen[n])} et {rel(mod['path'])} : les noms de niveau module doivent être uniques")
            seen[n] = mod["path"]
    return order


def template():
    tpl = TEMPLATE.read_text(encoding="utf-8")
    for marker in ("<!-- @STYLES -->", "<!-- @SCRIPT -->"):
        if tpl.count(marker) != 1:
            raise BuildError(f"{rel(TEMPLATE)} : le marqueur {marker} doit apparaître une seule fois")
    return tpl


def standalone():
    parts = ["(function () {\n'use strict';\n"]
    for mod in collect(ENTRY):
        parts.append(f"\n// ===== {rel(mod['path'])} =====\n{mod['body'].strip()}\n")
    parts.append("})();\n")
    html = template().replace("<!-- @STYLES -->", "<style>\n" + CSS.read_text(encoding="utf-8") + "</style>")
    html = html.replace("<!-- @SCRIPT -->", "<script>\n" + "".join(parts) + "</script>")
    html = ajouter_idees(html)
    return html.replace("<!doctype html>\n", "<!doctype html>\n" + BANNER, 1)


def ajouter_idees(html):
    textes = {}
    for fichier in sorted((ROOT / "web" / "i18n").glob("*.json")):
        traduction = json.loads(fichier.read_text(encoding="utf-8"))
        textes[fichier.stem] = {k: v for k, v in traduction.items() if k in ("ideeAction", "ideeAvertissement")}
    version = re.search(r"const VERSION = '([^']+)';", ENTRY.read_text(encoding="utf-8"))
    if not version:
        raise BuildError("version de l’application autonome introuvable")
    config = json.dumps({"page": "cercle", "version": version[1], "site": "https://www.kermiclab.online/", "textes": textes}, ensure_ascii=False).replace("<", "\\u003c")
    style = (ROOT / "web" / "boite-idees.css").read_text(encoding="utf-8")
    script = (ROOT / "web" / "boite-idees.js").read_text(encoding="utf-8")
    return html.replace("</body>", '<script type="application/json" id="boite-idees-config">' + config
                        + "</script>\n<style>" + style + "</style>\n<script>" + script + "</script>\n</body>")


def dev():
    collect(ENTRY)  # mêmes vérifications que le livrable
    html = template().replace("<!-- @STYLES -->", '<link rel="stylesheet" href="styles/app.css">')
    return ajouter_idees(html.replace("<!-- @SCRIPT -->", '<script type="module" src="ui/main.js"></script>'))


def main(argv):
    try:
        if "--dev" in argv:
            DEV.write_text(dev(), encoding="utf-8")
            print(f"{rel(DEV)} écrit : servez la racine (tâche « Serveur local ») puis ouvrez http://localhost:8000/src/dev.html")
            return 0
        html = standalone()
        if "--check" in argv:
            if not OUT.exists() or OUT.read_text(encoding="utf-8") != html:
                print("index.html n'est pas à jour avec src/ : lancez python3 scripts/build-standalone.py", file=sys.stderr)
                return 1
            print("index.html à jour avec src/")
            return 0
        out = Path(argv[argv.index("--out") + 1]) if "--out" in argv else OUT
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print(f"{out} écrit ({len(html.encode('utf-8'))} octets)")
        return 0
    except BuildError as e:
        print(f"Erreur de construction : {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
