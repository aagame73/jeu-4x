// Info-bulles au style du jeu. Les bulles natives du navigateur (attribut title) ne se
// stylent pas : au survol, on déplace le title dans data-tip et on affiche notre propre bulle.
// Les bulles déjà dessinées par les vues 3D (classe .tooltip) partagent le même style CSS.

export function installTooltips() {
  const bubble = document.createElement('div');
  bubble.className = 'tooltip ui-tooltip';
  document.body.appendChild(bubble);
  let target = null;

  function place(x, y) {
    const pad = 12;
    const { width, height } = bubble.getBoundingClientRect();
    const left = Math.min(x + 14, window.innerWidth - width - pad);
    const top = y + 18 + height > window.innerHeight - pad ? y - height - 10 : y + 18;
    bubble.style.left = `${Math.max(pad, left)}px`;
    bubble.style.top = `${Math.max(pad, top)}px`;
  }

  function show(el, x, y) {
    if (el.hasAttribute('title')) {
      el.dataset.tip = el.getAttribute('title');
      el.removeAttribute('title');
    }
    const text = el.dataset.tip;
    if (!text) return;
    // Première partie avant « : » mise en valeur, comme un titre.
    const cut = text.indexOf(' : ');
    bubble.innerHTML = '';
    if (cut > 0 && cut < 40) {
      const strong = document.createElement('strong');
      strong.textContent = text.slice(0, cut);
      const span = document.createElement('span');
      span.textContent = text.slice(cut + 3);
      bubble.append(strong, span);
    } else {
      bubble.textContent = text;
    }
    bubble.style.display = 'block';
    target = el;
    place(x, y);
  }

  function hide() {
    target = null;
    bubble.style.display = 'none';
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[title], [data-tip]');
    if (el && el !== target) show(el, e.clientX, e.clientY);
    else if (!el && target) hide();
  });
  document.addEventListener('mousemove', (e) => {
    if (!target) return;
    if (!target.isConnected || !target.contains(e.target)) hide();
    else place(e.clientX, e.clientY);
  });
  document.addEventListener('mousedown', hide);
  window.addEventListener('blur', hide);
}
