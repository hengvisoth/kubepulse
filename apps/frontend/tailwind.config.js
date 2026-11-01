const colors = require('tailwindcss/colors');

// The components were written for a dark theme (light text on slate-950). Flipping the
// shade scales gives a light theme without rewriting every class. 500 and 600 stay put
// so solid buttons keep their white text.
const flip = (c) => ({
  50: c[950],
  100: c[900],
  200: c[800],
  300: c[700],
  400: c[600],
  500: c[500],
  600: c[600],
  700: c[700],
  800: c[200],
  900: c[100],
  950: c[50],
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Sea-chart neutrals: 900 is the card surface, 950 the page, 100 the ink.
        slate: {
          50: '#0A1A2B',
          100: '#10243A',
          200: '#1B3350',
          300: '#2C4A63',
          400: '#486577',
          500: '#5B757D',
          600: '#7A9395',
          700: '#AFC5C2',
          800: '#C9DAD7',
          900: '#F9FCFB',
          950: '#E4EEEC',
        },
        teal: flip(colors.teal),
        cyan: flip(colors.cyan),
        emerald: flip(colors.emerald),
        rose: flip(colors.rose),
        amber: flip(colors.amber),
        orange: flip(colors.orange),
        purple: flip(colors.purple),
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
      },
      fontFamily: {
        display: ['ui-serif', '"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
