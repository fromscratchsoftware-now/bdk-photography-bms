function toNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const converted = Number(value);
  if (Number.isNaN(converted)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return converted;
}

export const env = {
  port: toNumber(process.env.PORT, 4000)
};

