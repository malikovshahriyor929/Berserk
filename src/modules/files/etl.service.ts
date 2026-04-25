import { prisma } from "../../config/prisma.js";
import { AttributeDataType, UploadStatus } from "../../generated/prisma/enums.js";
import { toDateOrNull } from "../../utils/decimal.js";
import { toJsonValue } from "../../utils/json.js";
import type { ParsedSheetDraft, ParsedAttributeDraft } from "./excel-parser.service.js";

type PersistInput = {
  userId: string;
  uploadId: string;
  sheets: ParsedSheetDraft[];
};

type PersistResult = {
  sheetCount: number;
  rowCount: number;
  attributeCount: number;
};

function sanitizeDate(value: unknown) {
  return toDateOrNull(value);
}

class EtlService {
  async persistParsedWorkbook(input: PersistInput): Promise<PersistResult> {
    let rowCount = 0;
    let attributeCount = 0;

    await prisma.uploadedFile.update({
      where: { id: input.uploadId },
      data: {
        status: UploadStatus.PARSING,
        errorMessage: null,
      },
    });

    for (const sheetDraft of input.sheets) {
      const sheet = await prisma.parsedSheet.create({
        data: {
          userId: input.userId,
          uploadId: input.uploadId,
          sheetName: sheetDraft.sheetName,
          detectedRange: sheetDraft.detectedRange,
          rowCount: sheetDraft.rowCount,
          columnCount: sheetDraft.columnCount,
          headerRowIndex: sheetDraft.headerRowIndex,
          headers: sheetDraft.headers,
          rawRows: toJsonValue(sheetDraft.rawRows),
          normalizedRows: toJsonValue(sheetDraft.normalizedRows),
        },
      });

      for (const rowDraft of sheetDraft.rows) {
        rowCount += 1;

        const row = await prisma.extractedRow.create({
          data: {
            userId: input.userId,
            uploadId: input.uploadId,
            sheetId: sheet.id,
            rowIndex: rowDraft.rowIndex,
            rowIdentityHash: rowDraft.rowIdentityHash,
            rawJson: toJsonValue(rowDraft.rawJson),
            normalizedJson: toJsonValue(rowDraft.normalizedJson),
            detectedDate: sanitizeDate(rowDraft.detectedDate),
            detectedAmount: rowDraft.detectedAmount,
            detectedType: rowDraft.detectedType,
          },
        });

        for (const attributeDraft of rowDraft.attributes) {
          attributeCount += 1;
          await this.upsertAttribute({
            userId: input.userId,
            uploadId: input.uploadId,
            sheetId: sheet.id,
            rowId: row.id,
            draft: attributeDraft,
          });
        }
      }
    }

    await prisma.uploadedFile.update({
      where: { id: input.uploadId },
      data: {
        status: UploadStatus.PARSED,
        parsedAt: new Date(),
      },
    });

    return {
      sheetCount: input.sheets.length,
      rowCount,
      attributeCount,
    };
  }

  private async upsertAttribute(input: {
    userId: string;
    uploadId: string;
    sheetId: string;
    rowId: string;
    draft: ParsedAttributeDraft;
  }) {
    const existing = await prisma.financialAttribute.findUnique({
      where: {
        userId_identityKey: {
          userId: input.userId,
          identityKey: input.draft.identityKey,
        },
      },
    });

    const nextAttributeData = {
      uploadId: input.uploadId,
      sheetId: input.sheetId,
      rowId: input.rowId,
      attributeKey: input.draft.attributeKey,
      label: input.draft.label,
      dataType: input.draft.dataType as AttributeDataType,
      sheetName: input.draft.sheetName,
      rowIndex: input.draft.rowIndex,
      columnIndex: input.draft.columnIndex,
      periodDate: sanitizeDate(input.draft.periodDate),
      currentValueRaw: input.draft.valueRaw,
      currentValueText: input.draft.valueText,
      currentValueNumber: input.draft.valueNumber,
      currentValueDate: sanitizeDate(input.draft.valueDate),
      currentValueJson: toJsonValue(input.draft.valueJson),
      rowIdentityHash: input.draft.rowIdentityHash,
      attributeHash: input.draft.attributeHash,
    };

    if (!existing) {
      const created = await prisma.financialAttribute.create({
        data: {
          userId: input.userId,
          identityKey: input.draft.identityKey,
          versionCount: 1,
          ...nextAttributeData,
        },
      });

      const version = await prisma.attributeVersion.create({
        data: {
          userId: input.userId,
          sourceUploadId: input.uploadId,
          attributeId: created.id,
          versionNo: 1,
          valueRaw: input.draft.valueRaw,
          valueText: input.draft.valueText,
          valueNumber: input.draft.valueNumber,
          valueDate: sanitizeDate(input.draft.valueDate),
          valueJson: toJsonValue(input.draft.valueJson),
          valueHash: input.draft.valueHash,
          periodDate: sanitizeDate(input.draft.periodDate),
          sourceSheetName: input.draft.sheetName,
          sourceRowIndex: input.draft.rowIndex,
          sourceColumnIndex: input.draft.columnIndex,
        },
      });

      await prisma.financialAttribute.update({
        where: { id: created.id },
        data: { latestVersionId: version.id },
      });

      return created;
    }

    const latestVersion = existing.latestVersionId
      ? await prisma.attributeVersion.findUnique({
          where: { id: existing.latestVersionId },
        })
      : await prisma.attributeVersion.findFirst({
          where: {
            attributeId: existing.id,
            isLatest: true,
          },
          orderBy: { versionNo: "desc" },
        });

    if (latestVersion?.valueHash === input.draft.valueHash) {
      return prisma.financialAttribute.update({
        where: { id: existing.id },
        data: nextAttributeData,
      });
    }

    const nextVersionNo = existing.versionCount + 1;

    return prisma.$transaction(async (tx) => {
      if (latestVersion) {
        await tx.attributeVersion.update({
          where: { id: latestVersion.id },
          data: {
            isLatest: false,
            validTo: new Date(),
          },
        });
      }

      const newVersion = await tx.attributeVersion.create({
        data: {
          userId: input.userId,
          sourceUploadId: input.uploadId,
          attributeId: existing.id,
          versionNo: nextVersionNo,
          valueRaw: input.draft.valueRaw,
          valueText: input.draft.valueText,
          valueNumber: input.draft.valueNumber,
          valueDate: sanitizeDate(input.draft.valueDate),
          valueJson: toJsonValue(input.draft.valueJson),
          valueHash: input.draft.valueHash,
          periodDate: sanitizeDate(input.draft.periodDate),
          sourceSheetName: input.draft.sheetName,
          sourceRowIndex: input.draft.rowIndex,
          sourceColumnIndex: input.draft.columnIndex,
        },
      });

      return tx.financialAttribute.update({
        where: { id: existing.id },
        data: {
          versionCount: nextVersionNo,
          latestVersionId: newVersion.id,
          ...nextAttributeData,
        },
      });
    });
  }
}

export default new EtlService();
