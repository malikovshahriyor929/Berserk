import XLSXModule from "xlsx";
import { type AttributeDataType } from "../../generated/prisma/enums.js";
import { detectDataType, columnLetter, isEmptyValue, normalizeKey, stringifyCell } from "../../utils/normalize.js";
import { toDateOrNull, toNumberOrNull } from "../../utils/decimal.js";
import { sha256 } from "../../utils/hash.js";
import { toJsonValue } from "../../utils/json.js";

export interface ParsedAttributeDraft {
  identityKey: string;
  attributeKey: string;
  label: string;
  dataType: AttributeDataType;
  sheetName: string;
  rowIndex: number;
  columnIndex: number;
  rowIdentityHash: string;
  periodDate: Date | null;
  valueRaw: string | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueJson: unknown;
  attributeHash: string;
  valueHash: string;
}

export interface ParsedRowDraft {
  rowIndex: number;
  rowIdentityHash: string;
  rawJson: Record<string, unknown>;
  normalizedJson: Record<string, unknown>;
  detectedDate: Date | null;
  detectedAmount: number | null;
  detectedType: string | null;
  attributes: ParsedAttributeDraft[];
}

export interface ParsedSheetDraft {
  sheetName: string;
  detectedRange: string | null;
  rowCount: number;
  columnCount: number;
  headerRowIndex: number | null;
  headers: string[];
  rawRows: unknown[][];
  normalizedRows: Record<string, unknown>[];
  rows: ParsedRowDraft[];
}

function findHeaderRowIndex(rows: unknown[][]) {
  const index = rows.findIndex((row) => row.some((value) => !isEmptyValue(value)));
  return index >= 0 ? index : null;
}

function buildHeaders(headerRow: unknown[] | undefined, columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => {
    const original = stringifyCell(headerRow?.[index]);
    return original || `Column ${columnLetter(index)}`;
  });
}

function findRowIdentity(sheetName: string, rowIndex: number, row: Record<string, unknown>) {
  const entries = Object.entries(row);
  const dateEntry = entries.find(([key, value]) => key.includes("date") && !isEmptyValue(value));
  const descriptionEntry = entries.find(
    ([key, value]) =>
      (key.includes("description") || key.includes("details") || key.includes("counterparty") || key.includes("name")) &&
      !isEmptyValue(value),
  );
  const amountEntry = entries.find(
    ([key, value]) =>
      (key.includes("amount") || key.includes("value") || key.includes("total") || key.includes("sum") || key.includes("balance")) &&
      !isEmptyValue(value),
  );

  if (dateEntry && descriptionEntry && amountEntry) {
    return sha256(
      `${sheetName}|${stringifyCell(dateEntry[1])}|${stringifyCell(descriptionEntry[1])}|${stringifyCell(amountEntry[1])}`,
    );
  }

  return sha256(`${sheetName}|${rowIndex}|${JSON.stringify(row)}`);
}

function detectRowDate(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (key.includes("date") || key.includes("period")) {
      const date = toDateOrNull(value);
      if (date) {
        return date;
      }
    }
  }

  for (const value of Object.values(row)) {
    const date = toDateOrNull(value);
    if (date) {
      return date;
    }
  }

  return null;
}

function detectRowAmount(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (
      key.includes("amount") ||
      key.includes("value") ||
      key.includes("income") ||
      key.includes("expense") ||
      key.includes("balance")
    ) {
      const amount = toNumberOrNull(value);
      if (amount !== null) {
        return amount;
      }
    }
  }

  return null;
}

const XLSX = XLSXModule;

class ExcelParserService {
  parseFile(filePath: string) {
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,
      raw: true,
    });

    const parsedSheets: ParsedSheetDraft[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }
      const detectedRange = worksheet["!ref"] ?? null;
      const matrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: true,
      }) as unknown[][];

      const headerRowIndex = findHeaderRowIndex(matrix);
      const columnCount = Math.max(
        0,
        ...matrix.map((row) => row.length),
      );
      const headers = buildHeaders(
        headerRowIndex === null ? undefined : matrix[headerRowIndex],
        columnCount,
      );

      const normalizedRows: Record<string, unknown>[] = [];
      const rowDrafts: ParsedRowDraft[] = [];
      const dataStartIndex = headerRowIndex === null ? 0 : headerRowIndex + 1;

      for (let rawIndex = dataStartIndex; rawIndex < matrix.length; rawIndex += 1) {
        const rawRow = matrix[rawIndex] ?? [];
        const normalizedRow: Record<string, unknown> = {};
        const rawRowObject: Record<string, unknown> = {};

        headers.forEach((header, columnIndex) => {
          const normalizedHeader = normalizeKey(header) || `column_${columnLetter(columnIndex).toLowerCase()}`;
          const cellValue = rawRow[columnIndex] ?? null;
          rawRowObject[header] = cellValue;
          normalizedRow[normalizedHeader] = cellValue;
        });

        const hasContent = Object.values(normalizedRow).some((value) => !isEmptyValue(value));
        if (!hasContent) {
          continue;
        }

        const rowIndex = rawIndex + 1;
        const detectedDate = detectRowDate(normalizedRow);
        const detectedAmount = detectRowAmount(normalizedRow);
        const rowIdentityHash = findRowIdentity(sheetName, rowIndex, normalizedRow);

        const attributes = headers
          .map((header, columnIndex): ParsedAttributeDraft | null => {
            const normalizedHeader = normalizeKey(header) || `column_${columnLetter(columnIndex).toLowerCase()}`;
            const rawValue = rawRow[columnIndex] ?? null;

            if (isEmptyValue(rawValue)) {
              return null;
            }

            const dataType = detectDataType(rawValue, header);
            const valueText = stringifyCell(rawValue) || null;
            const valueNumber = toNumberOrNull(rawValue);
            const valueDate = toDateOrNull(rawValue);
            const periodDate =
              normalizedHeader.includes("date") || normalizedHeader.includes("period")
                ? valueDate
                : detectedDate;
            const valueRaw = valueText;
            const valueJson = toJsonValue(rawValue instanceof Date ? rawValue.toISOString() : rawValue);
            const attributeHash = sha256(
              `${sheetName}|${rowIndex}|${columnIndex}|${normalizedHeader}|${valueText ?? ""}`,
            );
            const valueHash = sha256(
              JSON.stringify({
                valueRaw,
                valueText,
                valueNumber,
                valueDate: valueDate?.toISOString() ?? null,
              }),
            );

            return {
              identityKey: sha256(`${sheetName}|${rowIdentityHash}|${normalizedHeader}`),
              attributeKey: normalizedHeader,
              label: header,
              dataType,
              sheetName,
              rowIndex,
              columnIndex,
              rowIdentityHash,
              periodDate,
              valueRaw,
              valueText,
              valueNumber,
              valueDate,
              valueJson,
              attributeHash,
              valueHash,
            } satisfies ParsedAttributeDraft;
          })
          .filter((value): value is ParsedAttributeDraft => value !== null);

        normalizedRows.push(normalizedRow);
        rowDrafts.push({
          rowIndex,
          rowIdentityHash,
          rawJson: toJsonValue(rawRowObject) as Record<string, unknown>,
          normalizedJson: toJsonValue(normalizedRow) as Record<string, unknown>,
          detectedDate,
          detectedAmount,
          detectedType: detectedAmount === null ? null : detectedAmount >= 0 ? "credit" : "debit",
          attributes,
        });
      }

      parsedSheets.push({
        sheetName,
        detectedRange,
        rowCount: rowDrafts.length,
        columnCount,
        headerRowIndex: headerRowIndex === null ? null : headerRowIndex + 1,
        headers,
        rawRows: toJsonValue(matrix) as unknown[][],
        normalizedRows: toJsonValue(normalizedRows) as Record<string, unknown>[],
        rows: rowDrafts,
      });
    }

    return parsedSheets;
  }
}

export default new ExcelParserService();
