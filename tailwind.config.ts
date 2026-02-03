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
        "theme-bg-elevated": "var(--color-bg-elevated)",
        "theme-bg-elevated-hover": "var(--color-bg-elevated-hover)",
        "theme-bg-input": "var(--color-bg-input)",
        "theme-accent": "var(--color-accent)",
        "theme-text": "var(--color-text)",
        "theme-text-muted": "var(--color-text-muted)",
        "theme-text-muted-strong": "var(--color-text-muted-strong)",
        "theme-border": "var(--color-border)",
      },
      borderRadius: {
        xl: "0.75rem"
      }
    }
  },
  plugins: []
};

export default config;


