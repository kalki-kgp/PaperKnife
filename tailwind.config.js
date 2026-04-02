/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Quicksand"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        terracotta: {
          50: '#FFF3F0',
          100: '#FFE4DE',
          200: '#FFD0C4',
          300: '#FFB5A3',
          400: '#F29D88',
          500: '#E68A73',
          600: '#D47560',
          700: '#AD5040',
          800: '#A04A3C',
          900: '#7D3A2F',
        },
        'accent-peach': '#FFE4DE',
        'accent-yellow': '#FFF9E6',
        'text-main': '#4A3B37',
        'text-muted': '#6B5A55',
      },
      boxShadow: {
        'clay': '12px 12px 24px rgba(230, 138, 115, 0.15), -12px -12px 24px rgba(255, 255, 255, 0.8)',
        'clay-sm': '6px 6px 12px rgba(230, 138, 115, 0.1), -6px -6px 12px rgba(255, 255, 255, 0.6)',
        'clay-lg': '16px 16px 32px rgba(230, 138, 115, 0.2), -16px -16px 32px rgba(255, 255, 255, 0.9)',
        'clay-inset': 'inset 4px 4px 8px rgba(255, 255, 255, 0.6), inset -4px -4px 8px rgba(230, 138, 115, 0.1)',
        'clay-button': '0 8px 16px rgba(230, 138, 115, 0.3)',
        'clay-button-hover': '0 12px 20px rgba(230, 138, 115, 0.4)',
      },
      borderRadius: {
        'clay': '32px',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        }
      },
      animation: {
        'slide-in': 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    },
  },
  plugins: [],
}
