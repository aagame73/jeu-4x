// Fonds peints (images de Gemini, public/fonds/) : une couche qui dérive lentement, sous un voile sombre.
// fond('victoire.jpg', 0.5) renvoie le HTML de la couche, à placer en premier dans un écran en
// position relative/fixed ; l'image ne se charge qu'à l'affichage de l'écran.
import './styles/fonds.css';

export const fondUrl = (nom) => `${import.meta.env.BASE_URL}fonds/${nom}`;

// voile : opacité du voile sombre (0 = image pure, 1 = noir) ; classe : variante de placement.
export function fond(nom, voile = 0.6, classe = '') {
  return `<div class="fond ${classe}" aria-hidden="true" style="--voile:${voile}">
    <div class="fond-image" style="background-image:url('${fondUrl(nom)}')"></div>
  </div>`;
}

// Mondes natals des espèces jouables (fiche du choix d'espèce).
export const mondeNatal = (espece) => `monde-${espece}.jpg`;
