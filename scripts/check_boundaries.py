"""Vérifie le partage du dépôt entre les deux agents (voir AGENTS.md). Cette liste de zones fait foi.

Usage :
  python3 scripts/check_boundaries.py                       règles d'architecture sur src/
  python3 scripts/check_boundaries.py --agent moteur        + fichiers modifiés depuis origin/main dans la zone de l'agent
  python3 scripts/check_boundaries.py --agent auto          agent déduit de la branche (agent/moteur-…, agent/interface-…)
  options : --base REF (défaut origin/main)
"""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ZONES = {
    "moteur": ["src/core/", "src/pedagogy/", "src/solutions/", "src/selfcheck.js", "tests/core/", "tests/solutions/"],
    "interface": ["src/ui/", "src/styles/", "src/index.template.html", "tests/dom/"],
}
# Contrat entre agents : modifiable par l'un ou l'autre, mais toujours signalé pour coordination.
CONTRACT = ["src/api.js", "AGENTS.md", "SPEC.md", "ARCHITECTURE.md"]
# Fichiers communs : outillage, documentation, livrable généré.
COMMON = ["index.html", "CHANGELOG.md", "README.md", "CLAUDE.md", "package.json", "LICENSE", ".gitignore",
          "scripts/", "tests/build/", ".github/", ".vscode/", "versions/", "trigoLab.code-workspace"]
IGNORED = ["src/dev.html"]

FORBIDDEN_IN_MOTEUR = re.compile(
    r"\b(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame|cancelAnimationFrame|"
    r"setTimeout|setInterval|HTMLElement|KeyboardEvent|PointerEvent|fetch)\b")
IMPORT = re.compile(r"""^(?:import|export)\s*\{[^}]*\}\s*from\s*'([^']+)'""", re.M)


def matches(path, prefixes):
    return any(path == p or (p.endswith("/") and path.startswith(p)) for p in prefixes)


def owner(path):
    for agent, prefixes in ZONES.items():
        if matches(path, prefixes):
            return agent
    return None


def code_lines(text):
    """Lignes de code sans commentaires ni chaînes (approximation suffisante pour ce dépôt)."""
    out = []
    for line in text.splitlines():
        line = re.sub(r"'(?:\\.|[^'\\])*'", "''", line)
        line = line.split("//", 1)[0]
        out.append(line)
    return out


def check_architecture():
    errors = []
    for f in sorted((ROOT / "src").rglob("*")):
        if not f.is_file():
            continue
        path = f.relative_to(ROOT).as_posix()
        if path in IGNORED:
            continue
        zone = owner(path)
        if zone is None and path not in CONTRACT:
            errors.append(f"{path} : fichier sans agent responsable (ajoutez-le à une zone dans scripts/check_boundaries.py)")
            continue
        if not path.endswith(".js"):
            continue
        text = f.read_text(encoding="utf-8")
        for spec in IMPORT.findall(text):
            target = (f.parent / spec).resolve().relative_to(ROOT).as_posix()
            if path == "src/api.js":
                if owner(target) != "moteur":
                    errors.append(f"{path} : ne doit réexporter que du code Moteur ({target})")
            elif zone == "moteur" and owner(target) != "moteur":
                errors.append(f"{path} : le Moteur n'importe que du Moteur ({target})")
            elif zone == "interface" and target != "src/api.js" and owner(target) != "interface":
                errors.append(f"{path} : l'Interface n'importe le Moteur que via src/api.js ({target})")
        if zone == "moteur":
            for n, line in enumerate(code_lines(text), 1):
                m = FORBIDDEN_IN_MOTEUR.search(line)
                if m:
                    errors.append(f"{path}:{n} : « {m.group(1)} » interdit dans le Moteur (code pur, sans DOM ni navigateur)")
        if path == "src/api.js":
            for n, line in enumerate(code_lines(text), 1):
                if line.strip() and not re.match(r"^export\s*\{[^}]*\}\s*from\s*''\s*;\s*$", line.strip()):
                    errors.append(f"{path}:{n} : le contrat ne contient que des réexportations")
    return errors


def current_branch():
    ref = os.environ.get("GITHUB_HEAD_REF") or ""
    if ref:
        return ref
    try:
        return subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except OSError:
        return ""


def check_zone(agent, base):
    if agent == "auto":
        m = re.match(r"agent/(moteur|interface)\b", current_branch())
        if not m:
            print("Branche hors convention agent/moteur-… ou agent/interface-… : contrôle de zone ignoré.")
            return [], []
        agent = m.group(1)
    if agent not in ZONES:
        return [f"agent inconnu : {agent} (moteur ou interface)"], []
    diff = subprocess.run(["git", "diff", "--name-only", f"{base}...HEAD"], cwd=ROOT, capture_output=True, text=True)
    if diff.returncode:
        return [f"git diff impossible depuis {base} : {diff.stderr.strip()}"], []
    errors, notes = [], []
    other = [a for a in ZONES if a != agent][0]
    for path in diff.stdout.split():
        if matches(path, ZONES[other]):
            errors.append(f"{path} : zone de l'agent {other}, hors du périmètre de l'agent {agent}")
        elif path in CONTRACT:
            notes.append(f"{path} : contrat partagé modifié, coordination avec l'agent {other} requise")
        elif not matches(path, ZONES[agent]) and not matches(path, COMMON):
            errors.append(f"{path} : fichier non classé")
    print(f"Agent {agent} : {len(diff.stdout.split())} fichier(s) modifié(s) depuis {base}.")
    return errors, notes


def main(argv):
    errors, notes = check_architecture(), []
    if "--agent" in argv:
        base = argv[argv.index("--base") + 1] if "--base" in argv else "origin/main"
        e, notes = check_zone(argv[argv.index("--agent") + 1], base)
        errors += e
    for n in notes:
        print("Note : " + n)
    for e in errors:
        print("Erreur : " + e, file=sys.stderr)
    if not errors:
        print("Frontières entre agents respectées.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
