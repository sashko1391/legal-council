import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Simple direct colors - no HSL variables!
        navy: '#1E3A8A',        // Primary brand color
        teal: '#0F766E',        // Secondary
        crimson: '#BE123C',     // Critical risk
        orange: '#D97706',      // High risk  
        gold: '#B8860B',        // Medium risk
        green: '#15803D',       // Low/Safe risk
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['IBM Plex Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
