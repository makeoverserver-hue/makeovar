/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        gold: {
          50: '#fbf7eb',
          100: '#f5ebd0',
          200: '#ebd6a1',
          300: '#e0bf6b',
          400: '#d4a743',
          500: '#c48f2f',
          600: '#a97425',
          700: '#8a5721',
          800: '#714621',
          900: '#613b20',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f9fafb',
          dark: '#111827',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'premium': '0 20px 25px -5px rgb(236 72 153 / 0.1), 0 8px 10px -6px rgb(236 72 153 / 0.1)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
