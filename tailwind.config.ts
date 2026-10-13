import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        mist: 'rgb(var(--color-mist) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        brand: {
          50: '#ecfdf8',
          100: '#d1faee',
          500: '#0f766e',
          600: '#0b625d',
          700: '#0a4f4b'
        }
      },
      boxShadow: {
        panel: '0 10px 24px rgba(23, 32, 51, 0.08)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
