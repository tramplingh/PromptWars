import defaultColors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

/**
 * Dark mode swaps palettes instead of adding `dark:` variants to every class:
 * each themed colour is a CSS variable, and `html.dark` mirrors every scale
 * (50 ↔ 950, 100 ↔ 900, …), so light surfaces become dark and dark text light.
 */
const BRAND = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
};
const SCALES = {
  brand: BRAND,
  slate: defaultColors.slate,
  rose: defaultColors.rose,
  violet: defaultColors.violet,
  emerald: defaultColors.emerald,
  amber: defaultColors.amber,
  teal: defaultColors.teal,
  orange: defaultColors.orange,
  blue: defaultColors.blue,
  pink: defaultColors.pink,
  sky: defaultColors.sky,
};
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const mirror = (shade) => SHADES[SHADES.length - 1 - SHADES.indexOf(shade)];

const themedColors = Object.fromEntries(
  Object.keys(SCALES).map((name) => [
    name,
    Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`])),
  ]),
);

function paletteVars(dark) {
  const vars = {};
  for (const [name, scale] of Object.entries(SCALES)) {
    for (const s of SHADES) vars[`--${name}-${s}`] = rgb(scale[dark ? mirror(s) : s]);
  }
  const slate = defaultColors.slate;
  if (dark) {
    // Mid greys carry secondary text; lift them so they keep 4.5:1 on dark surfaces.
    vars['--slate-500'] = rgb(slate[400]);
    vars['--slate-600'] = rgb(slate[300]);
  }
  vars['--white'] = rgb(dark ? slate[900] : '#ffffff');
  vars['--canvas'] = rgb(dark ? slate[950] : '#f6f8fb');
  vars['--ink'] = rgb(dark ? slate[50] : slate[900]);
  return vars;
}

const themePalette = plugin(({ addBase }) => {
  addBase({ ':root': paletteVars(false), ':root.dark': paletteVars(true) });
});

/**
 * LabLink design tokens — an operations-console look: blue primary, cool
 * neutral canvas, white bordered cards, and semantic status colours.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        ...themedColors,
        white: 'rgb(var(--white) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04)',
        raised: '0 8px 24px rgb(15 23 42 / 0.10), 0 2px 6px rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        dash: { to: { strokeDashoffset: '-24' } },
        'pin-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        dash: 'dash 0.8s linear infinite',
        'pin-pulse': 'pin-pulse 1.6s ease-out infinite',
      },
    },
  },
  plugins: [themePalette],
};
