/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f4",
          100: "#d6ebe3",
          200: "#aed7c8",
          300: "#7ebfa9",
          400: "#4fa389",
          500: "#2f8a70",
          600: "#226e5a",
          700: "#1c5849",
          800: "#18463b",
          900: "#153a31",
        },
      },
    },
  },
  plugins: [],
};
