/** Plain display for bail amounts (site + bot). */
export function formatBailAmountForDisplay(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (Number.isInteger(amount)) return String(amount);
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
