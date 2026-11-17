# Prépare les vignettes des branches de recherche (images/ de Gemini, non commité) :
# 320 × 320 en JPEG dans public/recherche/<clé de la branche>.jpg.
# Usage : python docs/outils/vignettes.py
from pathlib import Path
from PIL import Image

racine = Path(__file__).resolve().parents[2]
src = racine / 'images'
out = racine / 'public' / 'recherche'
out.mkdir(parents=True, exist_ok=True)

VIGNETTES = {
    'propulsion': 'Propulsion.jpg',
    'structure': 'Coques.jpg',
    'armement': 'Armement.jpg',
    'industrie': 'Industrie.jpg',
    'vie': 'Vie.jpg',
    'energie': 'Énergie.jpg',
    'veilleurs': 'Xeno-archeologie.jpg',
}
TAILLE = 320

for cle, nom in VIGNETTES.items():
    chemin = src / nom
    if not chemin.exists():
        print('absent :', nom)
        continue
    im = Image.open(chemin).convert('RGB').resize((TAILLE, TAILLE), Image.LANCZOS)
    im.save(out / f'{cle}.jpg', quality=82, optimize=True, progressive=True)
    print(f'{cle:10} {(out / f"{cle}.jpg").stat().st_size // 1024} Ko')
