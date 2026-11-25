export const DEFAULT_SETTINGS = Object.freeze({
  theme: "dark",
  accent: "purple",
  customAccent: "",
  currency: "BRL",
  density: "comfortable",
  fontScale: "normal",
  widgets: Object.freeze({
    stats: true,
    chart: true,
    advisor: true,
    transactions: true,
    categories: true
  })
});

const isHexColor = value => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const widgets = source.widgets && typeof source.widgets === "object" && !Array.isArray(source.widgets)
    ? source.widgets : {};
  return {
    theme: source.theme === "light" ? "light" : "dark",
    accent: ["purple", "blue", "green", "red"].includes(source.accent) ? source.accent : "purple",
    customAccent: isHexColor(source.customAccent) ? source.customAccent : "",
    currency: ["BRL", "USD", "EUR"].includes(source.currency) ? source.currency : "BRL",
    density: source.density === "compact" ? "compact" : "comfortable",
    fontScale: ["small", "normal", "large"].includes(source.fontScale) ? source.fontScale : "normal",
    widgets: {
      stats: widgets.stats !== false,
      chart: widgets.chart !== false,
      advisor: widgets.advisor !== false,
      transactions: widgets.transactions !== false,
      categories: widgets.categories !== false
    }
  };
}

export function readSettings(serialized) {
  if (typeof serialized !== "string" || !serialized.trim()) return normalizeSettings(DEFAULT_SETTINGS);
  try {
    return normalizeSettings(JSON.parse(serialized));
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}
