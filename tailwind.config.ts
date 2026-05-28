import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'verde-cancha':  '#1a6b2f',
        'verde-oscuro':  '#0d1f0f',
        'verde-medio':   '#112213',
        'verde-borde':   '#1a3b1e',
        'dorado':        '#c8a84b',
        'azul-lazar':    '#0f2557',
        'gris-texto':    '#aaaaaa',
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      letterSpacing: {
        'widest2': '0.125em',
      },
    },
  },
  plugins: [],
}

export default config
