import { AttributeDataType } from "../generated/prisma/enums.js";

export function normalizeKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[%]/g, " percent ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function columnLetter(index: number) {
  let current = index + 1;
  let label = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

export function isEmptyValue(value: unknown) {
  return value === null || value === undefined || `${value}`.trim() === "";
}

export function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value).trim();
}

export function detectDataType(
  value: unknown,
  header: string,
): AttributeDataType {
  if (value instanceof Date) {
    return AttributeDataType.DATE;
  }

  if (typeof value === "boolean") {
    return AttributeDataType.BOOLEAN;
  }

  if (typeof value === "number") {
    const normalizedHeader = normalizeKey(header);
    if (normalizedHeader.includes("percent")) {
      return AttributeDataType.PERCENT;
    }
    if (
      normalizedHeader.includes("amount") ||
      normalizedHeader.includes("price") ||
      normalizedHeader.includes("balance") ||
      normalizedHeader.includes("income") ||
      normalizedHeader.includes("expense")
    ) {
      return AttributeDataType.CURRENCY;
    }
    return AttributeDataType.NUMBER;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return AttributeDataType.UNKNOWN;
    }

    if (/^\d+(\.\d+)?%$/.test(trimmed)) {
      return AttributeDataType.PERCENT;
    }

    if (/^\$?\-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed) || /^\-?\d+(\.\d+)?$/.test(trimmed)) {
      return AttributeDataType.NUMBER;
    }

    if (!Number.isNaN(Date.parse(trimmed))) {
      return AttributeDataType.DATE;
    }

    if (trimmed === "true" || trimmed === "false") {
      return AttributeDataType.BOOLEAN;
    }
  }

  return AttributeDataType.TEXT;
}
