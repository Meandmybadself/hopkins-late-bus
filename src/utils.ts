export function normalizeBusRoute(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}
