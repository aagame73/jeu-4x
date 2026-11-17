# Prépare les portraits peints (images/ « Portrait <espèce>.jpg », non commité) pour le jeu :
# recadrage sur le cercle intérieur quand Gemini en a dessiné un (le jeu découpe déjà en rond),
# puis 512 × 512 en JPEG dans public/portraits/<clé de l'espèce>.jpg.
# Usage : python docs/outils/portraits.py [dossier de sortie pour une planche de contrôle]
import sys
from pathlib import Path
from PIL import Image, ImageDraw

racine = Path(__file__).resolve().parents[2]
src = racine / 'images'
out = racine / 'public' / 'portraits'
out.mkdir(parents=True, exist_ok=True)

# clé de l'espèce : (fichier source, rayon gardé en fraction de la largeur, décalage vertical du centre)
PORTRAITS = {
    'vaskhar': ('Portrait Vaskhar.jpg', 0.405, 0.0),
    'ondesiens': ('Portrait Ondésien.jpg', 0.43, 0.0),
    'keltirr': ('Portrait Kel-Tirr.jpg', 0.43, 0.0),
    'synodes': ('Portrait Synode.jpg', 0.40, 0.0),
    'orrhaides': ('Portrait Orrhaïde.jpg', 0.45, 0.0),
    'thrennes': ('Portrait Threnne.jpg', 0.46, 0.0),
    'liseurs': ('Portrait Liseur de Vey.jpg', 0.5, 0.0),
    'ashkari': ('Portrait Ashkari.jpg', 0.5, 0.0),
    'sans-espece': ('Portrait Colons.jpg', 0.43, 0.0),
}
TAILLE = 512

faits = []
for cle, (nom, rayon, dy) in PORTRAITS.items():
    chemin = src / nom
    if not chemin.exists():
        print('absent :', nom)
        continue
    im = Image.open(chemin).convert('RGB')
    w, h = im.size
    cx, cy, r = w / 2, h / 2 + dy * h, rayon * w
    im = im.crop((round(cx - r), round(cy - r), round(cx + r), round(cy + r))).resize((TAILLE, TAILLE), Image.LANCZOS)
    im.save(out / f'{cle}.jpg', quality=84, optimize=True, progressive=True)
    faits.append((cle, im))
    print(f'{cle:12} {(out / f"{cle}.jpg").stat().st_size // 1024} Ko')

# Planche de contrôle : chaque portrait découpé en rond, comme dans le jeu.
if len(sys.argv) > 1 and faits:
    T = 256
    planche = Image.new('RGB', (T * len(faits), T), '#0a0e18')
    masque = Image.new('L', (T, T), 0)
    ImageDraw.Draw(masque).ellipse((0, 0, T - 1, T - 1), fill=255)
    for i, (_, im) in enumerate(faits):
        planche.paste(im.resize((T, T)), (i * T, 0), masque)
    planche.save(Path(sys.argv[1]) / 'portraits-ronds.jpg', quality=85)
