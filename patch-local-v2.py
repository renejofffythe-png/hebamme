#!/usr/bin/env python3
"""
Führe im Ordner hebamme-buchungssystem-v3 aus:
  python3 patch-local-v2.py
"""
import re, shutil, os

HTML = os.path.join("frontend", "index.html")

if not os.path.exists(HTML):
    print("✗ frontend/index.html nicht gefunden.")
    exit(1)

shutil.copy(HTML, HTML + ".backup2")
with open(HTML, "r", encoding="utf-8") as f:
    content = f.read()

original_len = len(content)

# ── 1. Nur das <img> Tag austauschen ────────────────────────────────
# Ersetzt nur den src-Attribut-Wert, lässt alles andere in Ruhe
content_new = re.sub(
    r'src="data:image/[^"]{20,}"',   # mindestens 20 Zeichen = base64
    'src="kristina.png"',
    content,
    count=1   # nur das erste Vorkommen
)
if len(content_new) < len(content) - 1000:
    print(f"✓ Base64 ({(original_len - len(content_new))//1024} KB) → kristina.png ersetzt")
    content = content_new
else:
    print("⚠ Base64-Bild nicht gefunden – evtl. schon ersetzt")

# ── 2. Fade-CSS einfügen: direkt nach .hero-col-photo { } ───────────
# Wir fügen NEUEN Code ein, nichts wird gelöscht
FADE_CSS = """
.photo-fade-wrap {
  width: 420px;
  height: 420px;
  position: relative;
  flex-shrink: 0;
}
.photo-fade-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 68% 68% at 50% 46%,
    transparent 32%,
    rgba(246, 240, 232, 0.45) 50%,
    rgba(244, 237, 228, 0.88) 68%,
    rgba(243, 236, 226, 1) 82%
  );
  pointer-events: none;
  z-index: 1;
}
"""

if '.photo-fade-wrap' not in content:
    # Nach dem .hero-col-photo { ... } Block einfügen
    content = re.sub(
        r'(\.hero-col-photo\s*\{[^}]*\})',
        r'\1' + FADE_CSS,
        content,
        count=1
    )
    print("✓ Fade-CSS eingefügt")
else:
    print("✓ Fade-CSS bereits vorhanden")

# ── 3. img in photo-fade-wrap wickeln ───────────────────────────────
if 'photo-fade-wrap' in content and '<div class="photo-fade-wrap">' not in content:
    content = re.sub(
        r'(<div class="hero-col-photo">[^<]*?)(<img\b)',
        r'\1<div class="photo-fade-wrap">\n        \2',
        content,
        count=1,
        flags=re.DOTALL
    )
    # Schließendes </div> nach dem img einfügen
    content = re.sub(
        r'(src="kristina\.png"[^>]*/?>)(\s*</div>\s*<div class="hero-col-text">)',
        r'\1\n      </div>\2',
        content,
        count=1
    )
    print("✓ Wrapper-Div eingefügt")
elif '<div class="photo-fade-wrap">' in content:
    print("✓ Wrapper-Div bereits vorhanden")

with open(HTML, "w", encoding="utf-8") as f:
    f.write(content)

print()
print(f"   Dateigröße vorher: {original_len//1024} KB")
print(f"   Dateigröße nachher: {len(content)//1024} KB")
print()
print("✅ Fertig! Jetzt:")
print("   1. Server läuft? → falls nicht: npm run dev")
print("   2. http://localhost:3000 → Strg+Shift+R")
