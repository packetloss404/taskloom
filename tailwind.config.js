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
          950: "#050505",
          900: "#0a0a0a",
          850: "#111111",
          800: "#1a1a1a",
          700: "#262626",
          600: "#3f3f46",
          500: "#52525b",
          400: "#71717a",
          300: "#a1a1aa",
          200: "#d4d4d8",
          100: "#f4f4f5",
        },
        accent: {
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#52525b",
          600: "#3f3f46",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 40px -20px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
