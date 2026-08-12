/** @type {import('tailwindcss').Config} */
module.exports = {
  // Manual toggle (see lib/theme.js / components/ThemeToggle.js), not
  // OS-only — "class" lets the toggle add/remove `dark` on <html>.
  darkMode: "class",
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // A primary accent so active nav/CTAs aren't just slate-on-slate
        // — the rest of the app still uses stock Tailwind slate for
        // neutrals, this is additive, not a full re-theme.
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
    },
  },
  plugins: [],
};
