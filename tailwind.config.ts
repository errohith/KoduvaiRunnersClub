import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Brand colours are CSS variables set from the database (website_settings.branding),
// so admins can re-theme the site without a rebuild.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
          ink: "rgb(var(--ink) / <alpha-value>)",
          accent: "rgb(var(--accent) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: { content: "72rem" },
    },
  },
  plugins: [typography],
} satisfies Config;
