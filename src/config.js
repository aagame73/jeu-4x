// Réglages du prototype. Les distances sont en années-lumière (al).
export const CONFIG = {
  starCount: 140,
  clusterRadius: 100,
  minStarSpacing: 7,
  jumpRange: 22, // portée de saut d'une sonde
  sensorRange: 28, // rayon dans lequel une sonde repère des lueurs
  probeSpeed: 2, // al parcourues par jour
  currentSpeedFactor: 5, // un courant gravitationnel multiplie la vitesse
  analyseDays: 10, // jours pour connaître la composition d'un système
  secondsPerDay: 1, // durée d'un jour à la vitesse x1
  speeds: [1, 2, 4],
  probeCount: 3,
  ruinCount: 9,
  extraCurrents: 8,
};
