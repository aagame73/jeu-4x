# Génère les icônes du jeu à partir d'une image carrée « style icône d'application »
# (un carré arrondi posé sur une marge sombre).
# Usage : python docs/outils/icones.py <image source> [gauche haut droite bas]
# Le cadre par défaut correspond à l'image Gemini du 15/11/2026 (1024 × 1024).
import sys
from pathlib import Path
from PIL import Image, ImageDraw

src = Image.open(sys.argv[1]).convert('RGB')
box = tuple(int(v) for v in sys.argv[2:6]) if len(sys.argv) >= 6 else (176, 176, 848, 848)
out = Path(__file__).resolve().parents[2] / 'public'

carre = src.crop(box)


def arrondie(taille):
    """Icône aux coins arrondis transparents (navigateur, écran d'accueil)."""
    grand = taille * 4  # masque dessiné en grand puis réduit : bords lisses
    masque = Image.new('L', (grand, grand), 0)
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, grand - 1, grand - 1), radius=int(grand * 0.18), fill=255)
    img = carre.resize((taille, taille), Image.LANCZOS).convert('RGBA')
    img.putalpha(masque.resize((taille, taille), Image.LANCZOS))
    return img


for taille in (32, 192, 512):
    arrondie(taille).save(out / f'icone-{taille}.png', optimize=True)

# Icône adaptative Android (« maskable ») : image pleine, sans coins ; on resserre
# un peu le cadre pour que les coins arrondis de la source ne se voient pas.
m = 24
pleine = src.crop((box[0] + m, box[1] + m, box[2] - m, box[3] - m)).resize((512, 512), Image.LANCZOS)
pleine.save(out / 'icone-adaptative-512.png', optimize=True)
print('Icônes écrites dans', out)
