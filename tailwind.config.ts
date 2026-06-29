import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0F1B3D',
          blue: '#2563eb',
          accent: '#22c55e',
        },
      },
    },
  },
  plugins: [],
};
export default config;
