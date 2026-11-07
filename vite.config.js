import { defineConfig } from 'vite';

// GitHub Pages sert le jeu sous /jeu-4x/ ; en développement, il reste à la racine.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/jeu-4x/' : '/',
}));
