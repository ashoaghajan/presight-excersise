// Tailwind v4 is wired through PostCSS; all design tokens live in
// `src/styles/index.css` via the `@theme` block, so there is no
// `tailwind.config.js` to keep in sync.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
