// Noms d'étoiles inventés, assemblés à partir de syllabes.
const SYLLABLES = [
  'ka', 'vor', 'ith', 'sel', 'an', 'dra', 'mi', 'os', 'tel', 'ur', 'ne', 'zha', 'qui', 'lor',
  've', 'ys', 'ar', 'em', 'ul', 'sa', 'ri', 'on', 'ce', 'bal', 'dun', 'ex', 'fi', 'go', 'hy',
  'ja', 'ko', 'lu', 'mo', 'nai', 'pe', 'ra', 'si', 'ta', 'va', 'xe', 'zo', 'thar', 'iel', 'sun',
];

export function createNameGenerator(rng) {
  const used = new Set();
  return {
    next() {
      for (;;) {
        const count = rng.chance(0.7) ? 2 : 3;
        let name = '';
        for (let i = 0; i < count; i++) name += rng.pick(SYLLABLES);
        name = name[0].toUpperCase() + name.slice(1);
        if (name.length >= 4 && !used.has(name)) {
          used.add(name);
          return name;
        }
      }
    },
  };
}
