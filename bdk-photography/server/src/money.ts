// v1: store all monetary values as integers (UGX).

export function parseUgx(input: unknown): number {
  const value = typeof input === "string" ? Number(input) : typeof input === "number" ? input : NaN;
  if (!Number.isFinite(value)) {
    throw new Error("Invalid amount");
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    throw new Error("Amount must be >= 0");
  }
  return rounded;
}

export function formatUgx(amount: number): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(amount);
}
