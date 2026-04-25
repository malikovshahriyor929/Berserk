const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;

function isSupportedDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const year = date.getUTCFullYear();
  return year >= MIN_SUPPORTED_YEAR && year <= MAX_SUPPORTED_YEAR;
}

export function toNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.\-]/g, "");
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
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
