/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          950: "#030f0b",
          900: "#062017",
          800: "#0a2c20",
          700: "#10402e",
          600: "#175a3f",
        },
        gold: {
          300: "#f3d78a",
          400: "#e3bd5d",
          500: "#c99a34",
          600: "#96721f",
        },
        sapphire: {
          300: "#7fb8e0",
          400: "#4f96c4",
          500: "#2c6f9e",
          600: "#235a80",
          700: "#1c4a6b",
        },
        ruby: {
          300: "#e39ab0",
          400: "#c85a78",
          500: "#a8304f",
          600: "#8c2743",
          700: "#741f37",
        },
        ink: {
          DEFAULT: "#f4ecd8",
          dim: "#cfe3d6",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
