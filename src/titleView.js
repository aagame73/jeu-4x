// Page titre : image de l'Arche en plein écran, titre et bouton « Jouer ».
// Elle se pose par-dessus l'écran d'accueil (ou le choix d'espèce), déjà ouvert dessous :
// « Jouer » la fait simplement disparaître en fondu.
import './styles/titre.css';

const STARS = 26; // étoiles scintillantes ajoutées sur l'image

export function createTitleView(root) {
  const stars = Array.from({ length: STARS }, () => {
    // dans le ciel seulement (le tiers bas de l'image est la planète)
    const x = (Math.random() * 100).toFixed(1);
    const y = (Math.random() * 62).toFixed(1);
    const delay = (Math.random() * 6).toFixed(2);
    const duration = (2.5 + Math.random() * 4).toFixed(2);
    const size = (1.5 + Math.random() * 2).toFixed(1);
    return `<i style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${duration}s"></i>`;
  }).join('');
  root.innerHTML = `
    <div class="title-bg" style="background-image:url('${import.meta.env.BASE_URL}titre.jpg')"></div>
    <div class="title-stars" aria-hidden="true">${stars}</div>
    <h1 class="title-name">L'Arche des Veilleurs</h1>
    <button class="title-play" type="button">Jouer</button>`;
  root.hidden = true;

  const onKey = (e) => {
    // la page titre capte le clavier : rien ne doit agir sur la partie dessous
    e.stopImmediatePropagation();
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      close();
    }
  };

  function open() {
    root.hidden = false;
    root.classList.remove('leaving');
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.title-play').focus({ preventScroll: true });
  }

  function close() {
    if (root.hidden || root.classList.contains('leaving')) return;
    window.removeEventListener('keydown', onKey, true);
    root.classList.add('leaving');
    setTimeout(() => (root.hidden = true), 700); // durée du fondu (titre.css)
  }

  root.querySelector('.title-play').addEventListener('click', close);

  return {
    get isOpen() {
      return !root.hidden;
    },
    open,
    close,
  };
}
