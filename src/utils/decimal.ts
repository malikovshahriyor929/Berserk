const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;
const MAX_DECIMAL_INTEGER_DIGITS = 16;

function isDateLikeString(value: string) {
  const normalized = value.trim();
  return (
    /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(normalized) ||
    /^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(normalized)
  );
}

function fitsPrismaDecimalRange(value: number) {
  if (!Number.isFinite(value)) {
    return false;
  }

  const integerPart = Math.abs(value).toFixed(4).split(".")[0] ?? "";
  return integerPart.length <= MAX_DECIMAL_INTEGER_DIGITS;
}

function isSupportedDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const year = date.getUTCFullYear();
  return year >= MIN_SUPPORTED_YEAR && year <= MAX_SUPPORTED_YEAR;
}

export function toNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return fitsPrismaDecimalRange(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || isDateLikeString(trimmed)) {
      return null;
    }

    const normalized = trimmed
      .replace(/[$€£¥₽₩₺₴₸₼₦₱₹₫₭₮₲₡₵₨%\s]/g, "")
      .replace(/,/g, "");

    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      return null;
    }

    const parsed = Number(normalized);
    return fitsPrismaDecimalRange(parsed) ? parsed : null;
  }

  return null;
}

export function toDateOrNull(value: unknown) {
  if (value instanceof Date) {
    return isSupportedDate(value) ? value : null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "$type" in value &&
    "value" in value &&
    (value as { $type?: unknown }).$type === "DateTime"
  ) {
    return toDateOrNull((value as { value?: unknown }).value ?? null);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return isSupportedDate(parsed) ? parsed : null;
  }

  return null;
}
