import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#121725",
        cardBg: "#1b2234",
        accent: "#2f80ed",
        "theme-body": "var(--color-bg-body)",
        "theme-sidebar": "var(--color-bg-sidebar)",
        "theme-card": "var(--color-bg-card)",
        "theme-main": "var(--color-bg-main)",
        "theme-schedule-footer": "var(--color-bg-schedule-footer)",
        "theme-accent": "var(--color-accent)",
      },
      borderRadius: {
        xl: "0.75rem"
      }
    }
  },
  plugins: []
};

export default config;


