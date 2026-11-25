export type AppSettings = {
  theme: "dark" | "light";
  accent: "purple" | "blue" | "green" | "red";
  customAccent: string;
  currency: "BRL" | "USD" | "EUR";
  density: "comfortable" | "compact";
  fontScale: "small" | "normal" | "large";
  widgets: {
    stats: boolean;
    chart: boolean;
    advisor: boolean;
    transactions: boolean;
    categories: boolean;
  };
};
export const DEFAULT_SETTINGS: AppSettings;
export function normalizeSettings(value: unknown): AppSettings;
export function readSettings(serialized: string | null): AppSettings;
