/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cinedark:  '#0a0a0f',
        cinegray:  '#111118',
        cineborder:'#1e1e2e',
        cineaccent:'#7c3aed',
        cinegold:  '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
