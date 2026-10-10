/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#030712',
          800: '#0b1120',
          700: '#111827',
        }
      }
    },
  },
  plugins: [],
}
