# Recompresse les images de Gemini (dossier images/, non commité) vers public/fonds/.
# Usage : python docs/outils/fonds.py
# Les noms des sources sont ceux donnés à la main ; deux étaient inversés (Victoire / Vaskhar).
from pathlib import Path
from PIL import Image

racine = Path(__file__).resolve().parents[2]
src = racine / 'images'
out = racine / 'public' / 'fonds'
out.mkdir(parents=True, exist_ok=True)

FONDS = {
    'Vaskhar.jpg': 'victoire.jpg',  # inversées à la génération
    'Victoire.jpg': 'monde-vaskhar.jpg',
    'Défaite.jpg': 'defaite.jpg',
    "intérieur de l'Arche.jpg": 'arche-interieur.jpg',
    'Premier contact.jpg': 'contact.jpg',
    'Écran de recherche .jpg': 'recherche.jpg',
    'Écran de diplomatie.jpg': 'diplomatie.jpg',
    'Ondésiens.jpg': 'monde-ondesiens.jpg',
    'Kel-Tirr.jpg': 'monde-keltirr.jpg',
    'Synodes.jpg': 'monde-synodes.jpg',
    'Orrhaïdes .jpg': 'monde-orrhaides.jpg',
    'Thrennes .jpg': 'monde-thrennes.jpg',
    'Liseurs de Vey.jpg': 'monde-liseurs.jpg',
    'Ashkari.jpg': 'monde-ashkari.jpg',
}

total = 0
for source, nom in FONDS.items():
    chemin = src / source
    if not chemin.exists():
        print('absente :', source)
        continue
    Image.open(chemin).convert('RGB').save(out / nom, quality=80, optimize=True, progressive=True)
    taille = (out / nom).stat().st_size
    total += taille
    print(f'{nom:24} {taille // 1024} Ko')
print(f'total : {total / 1024 / 1024:.1f} Mo')
