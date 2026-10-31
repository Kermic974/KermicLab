from pathlib import Path
import re, subprocess, tempfile
p = Path(__file__).resolve().parents[1] / "index.html"
s = p.read_text(encoding="utf-8")
assert "<!doctype html>" in s.lower()
assert "<svg" in s and "</svg>" in s
assert "<script>" in s and "</script>" in s
js = re.search(r"<script>([\s\S]*?)</script>", s, re.IGNORECASE)
assert js
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as f:
    f.write(js.group(1)); name=f.name
result = subprocess.run(["node", "--check", name], capture_output=True, text=True)
if result.returncode:
    raise SystemExit(result.stderr)
print("trigoLab: HTML et JavaScript valides")
