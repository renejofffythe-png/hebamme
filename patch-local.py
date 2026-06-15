#!/usr/bin/env python3
"""
Führe dieses Script im Ordner hebamme-buchungssystem-v3 aus:
  python3 patch-local.py
"""
import re, shutil, os

HTML = os.path.join("frontend", "index.html")

if not os.path.exists(HTML):
    print("✗ FEHLER: frontend/index.html nicht gefunden.")
    print("  Bitte sicherstellen dass du im Ordner hebamme-buchungssystem-v3 bist.")
    exit(1)

shutil.copy(HTML, HTML + ".backup")
print(f"✓ Backup erstellt: {HTML}.backup")

with open(HTML, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Base64-Bild ersetzen ──────────────────────────────────────────
old_len = len(content)
content = re.sub(
    r'<img src="data:image/[^;]+;base64,[^"]*" alt="Kristina Schuldeis[^"]*"[^/]*/?>',
    '<img src="kristina.png" alt="Kristina Schuldeis – Hebamme" />',
    content
)
if len(content) < old_len - 1000:
    print("✓ Base64-Bild → kristina.png ersetzt")
else:
    print("⚠ Base64-Bild nicht gefunden (evtl. schon ersetzt)")

# ── 2. Altes .hero-col-photo img CSS entfernen / ersetzen ────────────
# Suche nach dem Block und ersetze mask-image mit ::after Overlay

# Entferne alle mask-image Zeilen aus .hero-col-photo img
content = re.sub(
    r'(\.hero-col-photo img\s*\{[^}]*?)\s*-webkit-mask-[^;]+;',
    r'\1',
    content, flags=re.DOTALL
)
content = re.sub(
    r'(\.hero-col-photo img\s*\{[^}]*?)\s*mask-[^;]+;',
    r'\1',
    content, flags=re.DOTALL
)
print("✓ mask-image Eigenschaften entfernt")

# ── 3. .photo-fade-wrap Block einfügen (falls nicht vorhanden) ────────
if '.photo-fade-wrap' not in content:
    # Nach .hero-col-photo { einfügen
    content = content.replace(
        '.hero-col-photo {\n  position: relative;\n}',
        '''.hero-col-photo {
  position: relative;
}
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
    transparent 0%,
    transparent 32%,
    rgba(246, 240, 232, 0.45) 50%,
    rgba(244, 237, 228, 0.85) 68%,
    rgba(243, 236, 226, 1) 82%
  );
  pointer-events: none;
  z-index: 1;
}'''
    )
    print("✓ .photo-fade-wrap CSS eingefügt")
else:
    # Update existing block
    content = re.sub(
        r'\.photo-fade-wrap\s*\{[^}]*\}',
        '''.photo-fade-wrap {
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
    transparent 0%,
    transparent 32%,
    rgba(246, 240, 232, 0.45) 50%,
    rgba(244, 237, 228, 0.85) 68%,
    rgba(243, 236, 226, 1) 82%
  );
  pointer-events: none;
  z-index: 1;
}''',
        content
    )
    print("✓ .photo-fade-wrap CSS aktualisiert")

# ── 4. HTML: img in photo-fade-wrap einwickeln ────────────────────────
if 'photo-fade-wrap' not in content or '<div class="photo-fade-wrap">' not in content:
    content = re.sub(
        r'(<div class="hero-col-photo">)\s*(<img [^>]+>)',
        r'\1\n      <div class="photo-fade-wrap">\n        \2\n      </div>',
        content
    )
    print("✓ photo-fade-wrap div um img gewickelt")
else:
    print("✓ photo-fade-wrap div bereits vorhanden")

# ── 5. object-fit auf contain setzen ─────────────────────────────────
content = content.replace(
    'object-fit: cover;\n  object-position: center top;',
    'object-fit: contain;\n  object-position: center center;'
)
print("✓ object-fit: contain gesetzt")

with open(HTML, "w", encoding="utf-8") as f:
    f.write(content)

print()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("✅  FERTIG! Jetzt:")
print("   1. npm run dev  (falls nicht läuft)")
print("   2. Browser: http://localhost:3000")
print("   3. Strg+Shift+R (Hard-Refresh)")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
