export function parseBrazilianMoney(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw || !/^-?[\d.,]+$/.test(raw)) return null;

  let normalized = raw;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (dot >= 0) {
    const parts = raw.split(".");
    const last = parts[parts.length - 1];
    if (last.length === 3) normalized = parts.join("");
    else if (parts.length > 2) normalized = parts.slice(0, -1).join("") + "." + last;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
