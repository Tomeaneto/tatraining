import type { Config } from 'tailwindcss';

// Tokens da marca TA — preto, dourado, prata.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ta: {
          bg: '#080808',
          card: '#111111',
          card2: '#161616',
          border: '#222222',
          gold: '#F4952A',
          yellow: '#FFD700',
          text: '#F5F5F5',
          muted: '#9A9A9A',
          silver: '#C0C0C0',
        },
        zone: {
          1: '#6B6B6B',
          2: '#9A9A9A',
          3: '#C9A66B',
          4: '#F4952A',
          5: '#FFD700',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        sans: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(244, 149, 42, 0.45)',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
} satisfies Config;
