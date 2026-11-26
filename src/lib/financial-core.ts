export type DatedTransaction = { date: string };

export function filterMonthToDate<T extends DatedTransaction>(
  transactions: T[],
  monthKey: string,
  now: Date = new Date()
): T[] {
  const [year, month] = monthKey.split("-").map(Number);
  const isValidMonth = Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;
  if (!isValidMonth) return [];
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayKey = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return transactions.filter(item =>
    typeof item.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    item.date.startsWith(monthKey) &&
    (!isCurrentMonth || item.date <= todayKey)
  );
}

export function sumTransactionAmounts<T extends { amount: number | string }>(items: T[]): number {
  return items.reduce((total, item) => {
    const amount = Number(item.amount);
    return total + (Number.isFinite(amount) && amount >= 0 ? amount : 0);
  }, 0);
}
