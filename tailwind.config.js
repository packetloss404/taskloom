/** @type {import('tailwindcss').Config} */
export default {
  content: ["./web/index.html", "./web/src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          950: "#07070b",
          900: "#0b0b12",
          850: "#10111a",
          800: "#151624",
          700: "#1d1f2e",
          600: "#262838",
          500: "#383a4d",
          400: "#6b6e85",
          300: "#9599b0",
          200: "#c8cad9",
          100: "#e6e7f0",
        },
        accent: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 40px -20px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
