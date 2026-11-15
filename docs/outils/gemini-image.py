# Génère une image avec l'API Gemini (Google AI Studio).
# La clé est lue dans ~/.gemini-cle.txt (hors du dépôt, qui est public) : jamais dans le code.
# Usage : python docs/outils/gemini-image.py <fichier prompt.txt> <sortie.png> [image de style] [modèle]
# Les modèles sont essayés dans l'ordre jusqu'à ce que l'un réponde.
import base64, json, sys, urllib.request, urllib.error
from pathlib import Path

prompt = Path(sys.argv[1]).read_text(encoding='utf-8')
sortie = Path(sys.argv[2])
style = Path(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != '-' else None
modeles = [sys.argv[4]] if len(sys.argv) > 4 else ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']
cle = (Path.home() / '.gemini-cle.txt').read_text(encoding='utf-8').strip()

parts = []
if style:
    parts.append({'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(style.read_bytes()).decode()}})
    prompt = "Garde exactement le style de peinture de l'image jointe (mais pas sa composition).\n\n" + prompt
parts.append({'text': prompt})
corps = json.dumps({'contents': [{'parts': parts}], 'generationConfig': {'responseModalities': ['IMAGE', 'TEXT']}}).encode()

for modele in modeles:
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{modele}:generateContent',
        data=corps, headers={'Content-Type': 'application/json', 'x-goog-api-key': cle})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            rep = json.load(r)
    except urllib.error.HTTPError as e:
        err = json.loads(e.read() or b'{}').get('error', {})
        print(f'{modele} : erreur {e.code} {err.get("status", "")} : {err.get("message", "")[:300]}')
        continue
    for cand in rep.get('candidates', []):
        for p in cand.get('content', {}).get('parts', []):
            data = p.get('inlineData') or p.get('inline_data')
            if data:
                sortie.write_bytes(base64.b64decode(data['data']))
                print(f'{modele} : image écrite dans {sortie}')
                sys.exit(0)
            if p.get('text'):
                print(f'{modele} (texte) : {p["text"][:300]}')
    print(f'{modele} : pas d\'image dans la réponse ({json.dumps(rep)[:300]})')
sys.exit(1)
