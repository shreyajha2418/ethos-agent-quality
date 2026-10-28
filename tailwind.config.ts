import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        good: token('good'),
        watch: token('watch'),
        training: token('training'),
        terminated: token('terminated'),
        'c-ethos': token('c-ethos'),
        'c-nofault': token('c-nofault'),
        'c-skill': token('c-skill'),
        'c-oversold': token('c-oversold'),
        'c-ignored': token('c-ignored'),
        'c-inconclusive': token('c-inconclusive'),
        'c-replacement': token('c-replacement'),
        'c-clean': token('c-clean'),
        'c-team': token('c-team'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 30 40 / 0.05), 0 2px 8px rgb(15 30 40 / 0.04)',
        lift: '0 4px 10px rgb(15 30 40 / 0.08), 0 12px 28px rgb(15 30 40 / 0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
