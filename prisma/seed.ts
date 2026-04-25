import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";

const defaultTemplate = {
  title: "Default Financial Report",
  sections: [
    { type: "cover", title: "Financial Report" },
    { type: "metadata", title: "Uploaded File Metadata" },
    { type: "period", title: "Reporting Period" },
    { type: "summary", title: "Executive Summary" },
    { type: "metrics", title: "Key Metrics" },
    { type: "table", title: "Financial Table" },
    { type: "analysis", title: "AI Analysis" },
    { type: "anomalies", title: "Anomalies" },
    { type: "risks", title: "Risks" },
    { type: "recommendations", title: "Recommendations" },
    { type: "generatedAt", title: "Generated At" },
  ],
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthStart(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const demoUserEmail =
    process.env.SEED_DEMO_USER_EMAIL?.trim() ||
    "malikovshahriyor929@gmail.com";
  const demoUserPassword =
    process.env.SEED_DEMO_USER_PASSWORD?.trim() || "password123";
  const demoUserName =
    process.env.SEED_DEMO_USER_NAME?.trim() || "Demo Foydalanuvchi";

  const passwordHash = await bcrypt.hash(demoUserPassword, 10);

  // ── User ──────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: demoUserEmail },
    update: { name: demoUserName, fullName: demoUserName, passwordHash, isActive: true },
    create: { email: demoUserEmail, name: demoUserName, fullName: demoUserName, passwordHash },
  });

  console.log(`✓ User: ${user.email}`);

  // ── Report template ───────────────────────────────────────────────
  await prisma.reportTemplate.upsert({
    where: { id: `default-template-${user.id}` },
    update: { name: "Default Financial Report", description: "Default template", templateJson: defaultTemplate, isDefault: true },
    create: { id: `default-template-${user.id}`, userId: user.id, name: "Default Financial Report", description: "Default template", templateJson: defaultTemplate, isDefault: true },
  });

  await prisma.reportTemplate.upsert({
    where: { id: `pnl-template-${user.id}` },
    update: {},
    create: {
      id: `pnl-template-${user.id}`,
      userId: user.id,
      name: "Foyda va zarar hisoboti",
      description: "P&L hisoboti uchun shablon",
      templateJson: {
        title: "Foyda va Zarar Hisoboti",
        sections: [
          { type: "cover", title: "P&L Hisoboti" },
          { type: "summary", title: "Umumiy xulosa" },
          { type: "metrics", title: "Asosiy ko'rsatkichlar" },
          { type: "analysis", title: "AI tahlil" },
        ],
      },
      isDefault: false,
    },
  });

  console.log("✓ Report templates");

  // ── Uploaded files ────────────────────────────────────────────────
  const fileData = [
    { name: "moliyaviy_hisobot_2025_Q1.xlsx", status: "ANALYZED", daysAgoN: 90, sizeBytes: 245760 },
    { name: "moliyaviy_hisobot_2025_Q2.xlsx", status: "ANALYZED", daysAgoN: 60, sizeBytes: 312440 },
    { name: "balans_2025_H1.xlsx",            status: "ANALYZED", daysAgoN: 45, sizeBytes: 198200 },
    { name: "daromad_chiqim_iyul.xlsx",       status: "ANALYZED", daysAgoN: 30, sizeBytes: 156800 },
    { name: "daromad_chiqim_avgust.xlsx",     status: "ANALYZED", daysAgoN: 22, sizeBytes: 178900 },
    { name: "daromad_chiqim_sentabr.xlsx",    status: "ANALYZED", daysAgoN: 15, sizeBytes: 201300 },
    { name: "kvartal_hisobot_Q3.xlsx",        status: "PARSED",   daysAgoN: 10, sizeBytes: 289600 },
    { name: "xarajatlar_oktyabr.xlsx",        status: "ANALYZED", daysAgoN: 5,  sizeBytes: 134500 },
    { name: "yillik_reja_2026.xlsx",          status: "UPLOADED", daysAgoN: 2,  sizeBytes: 98400  },
  ];

  const uploadedAt = (n: number) => daysAgo(n);

  const uploads: any[] = [];
  for (const f of fileData) {
    const existing = await prisma.uploadedFile.findFirst({
      where: { userId: user.id, originalName: f.name },
    });
    if (existing) {
      uploads.push(existing);
      continue;
    }
    const upload = await prisma.uploadedFile.create({
      data: {
        userId: user.id,
        originalName: f.name,
        storedName: f.name.replace(".xlsx", `-seed.xlsx`),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        sizeBytes: f.sizeBytes,
        status: f.status as any,
        uploadedAt: uploadedAt(f.daysAgoN),
        parsedAt: f.status !== "UPLOADED" ? uploadedAt(f.daysAgoN - 1) : null,
        analyzedAt: f.status === "ANALYZED" ? uploadedAt(f.daysAgoN - 1) : null,
        createdAt: uploadedAt(f.daysAgoN),
      },
    });
    uploads.push(upload);
  }

  console.log(`✓ Uploaded files: ${uploads.length}`);

  // ── Parsed sheets (for PARSED/ANALYZED files) ─────────────────────
  const sheetDefs = [
    { name: "PnL_Wide_Monthly", rowCount: 147, columnCount: 15 },
    { name: "Balance_Sheet",    rowCount: 89,  columnCount: 12 },
    { name: "Cash_Flow",        rowCount: 63,  columnCount: 10 },
  ];

  const sheets: any[] = [];
  for (const upload of uploads.filter((u) => ["PARSED", "ANALYZED"].includes(u.status))) {
    for (const sd of sheetDefs.slice(0, 2)) {
      const existing = await prisma.parsedSheet.findFirst({
        where: { uploadId: upload.id, sheetName: sd.name },
      });
      if (existing) { sheets.push(existing); continue; }
      const sheet = await prisma.parsedSheet.create({
        data: {
          userId: user.id,
          uploadId: upload.id,
          sheetName: sd.name,
          detectedRange: `A1:O${sd.rowCount + 2}`,
          rowCount: sd.rowCount,
          columnCount: sd.columnCount,
          headerRowIndex: 1,
          headers: ["Attribute", "Entity", "Period", "Value", "Currency", "Unit", "Source"],
        },
      });
      sheets.push(sheet);
    }
  }

  console.log(`✓ Parsed sheets: ${sheets.length}`);

  // ── Financial attributes ───────────────────────────────────────────
  const attrDefs = [
    { key: "REV_TOTAL",      label: "Jami tushum",        type: "CURRENCY", value: 12430 },
    { key: "COGS_TOTAL",     label: "Jami tannarx",       type: "CURRENCY", value: -6316 },
    { key: "GROSS_PROFIT",   label: "Yalpi foyda",        type: "CURRENCY", value: 6114  },
    { key: "OPEX_TOTAL",     label: "Operatsion xarajat", type: "CURRENCY", value: -2840 },
    { key: "EBITDA",         label: "EBITDA",             type: "CURRENCY", value: 3274  },
    { key: "NET_PROFIT",     label: "Sof foyda",          type: "CURRENCY", value: 2890  },
    { key: "ASSET_TOTAL",    label: "Jami aktivlar",      type: "CURRENCY", value: 45200 },
    { key: "EQUITY_TOTAL",   label: "Kapital",            type: "CURRENCY", value: 28600 },
    { key: "DEBT_TOTAL",     label: "Qarz",               type: "CURRENCY", value: 16600 },
    { key: "CASH_FLOW_OPS",  label: "Operatsion CF",      type: "CURRENCY", value: 3120  },
    { key: "MARGIN_GROSS",   label: "Yalpi margin",       type: "PERCENT",  value: 49.2  },
    { key: "MARGIN_NET",     label: "Sof margin",         type: "PERCENT",  value: 23.2  },
  ];

  const analyzedUploads = uploads.filter((u) => u.status === "ANALYZED");

  for (const upload of analyzedUploads.slice(0, 3)) {
    for (const ad of attrDefs) {
      const identityKey = `${user.id}:${upload.id}:${ad.key}`;
      const existing = await prisma.financialAttribute.findUnique({
        where: { userId_identityKey: { userId: user.id, identityKey } },
      });
      if (existing) continue;

      await prisma.financialAttribute.create({
        data: {
          userId: user.id,
          uploadId: upload.id,
          identityKey,
          attributeKey: ad.key,
          label: ad.label,
          dataType: ad.type as any,
          sheetName: "PnL_Wide_Monthly",
          rowIndex: attrDefs.indexOf(ad) + 2,
          columnIndex: 4,
          currentValueRaw: String(ad.value),
          currentValueText: `${ad.value} UZS`,
          currentValueNumber: ad.value,
          versionCount: 1,
        },
      });
    }
  }

  console.log("✓ Financial attributes");

  // ── AI Analyses ───────────────────────────────────────────────────
  const resultJson = {
    reportType: "income_statement",
    language: "uz",
    summary: "Demo Moliya MChJ uchun 2025-yil moliyaviy hisoboti. Jami tushum 12,430 mln UZS, sof foyda 2,890 mln UZS.",
    metrics: {
      incomeTotal: 12430,
      expenseTotal: 9156,
      netTotal: 3274,
      transactionCount: 147,
    },
    categories: [
      { name: "Sotuvlar", amount: 8900 },
      { name: "Xizmatlar", amount: 2100 },
      { name: "Investitsiya", amount: 980 },
      { name: "Boshqa", amount: 450 },
    ],
    anomalies: [
      { field: "COGS_TOTAL", severity: "medium", description: "Tannarx 3 oy ichida 12% ga oshdi — ishlab chiqarish xarajatlari ko'paygan." },
      { field: "OPEX_TOTAL", severity: "low",    description: "Ma'muriy xarajatlar rejalanganidan 8% yuqori." },
    ],
    risks: [
      { category: "Likvidlik", severity: "medium", description: "Joriy likvidlik koeffitsienti 1.2 — minimal xavfsizlik chegarasida." },
      { category: "Valyuta",   severity: "low",    description: "USD/UZS kursining o'zgarishi eksport daromadiga ta'sir qilishi mumkin." },
    ],
    recommendations: [
      { priority: "yuqori",    description: "Tannarxni kamaytirish uchun etkazib beruvchilar bilan yangi shartnomalar tuzish." },
      { priority: "o'rta",     description: "Operatsion xarajatlarni avtomatlashtirish orqali 15% ga kamaytirish imkoniyatini ko'rib chiqing." },
      { priority: "past",      description: "Valyuta riski uchun xedjirovka strategiyasini joriy qiling." },
    ],
  };

  const analysisDefs = [
    { uploadIdx: 0, status: "SUCCESS",  daysAgoN: 89,  completedOffset: 1 },
    { uploadIdx: 1, status: "SUCCESS",  daysAgoN: 59,  completedOffset: 1 },
    { uploadIdx: 2, status: "SUCCESS",  daysAgoN: 44,  completedOffset: 1 },
    { uploadIdx: 3, status: "SUCCESS",  daysAgoN: 29,  completedOffset: 1 },
    { uploadIdx: 4, status: "SUCCESS",  daysAgoN: 21,  completedOffset: 1 },
    { uploadIdx: 5, status: "SUCCESS",  daysAgoN: 14,  completedOffset: 1 },
    { uploadIdx: 7, status: "FAILED",   daysAgoN: 4,   completedOffset: 0 },
  ];

  const analyses: any[] = [];
  for (const ad of analysisDefs) {
    const upload = uploads[ad.uploadIdx];
    if (!upload) continue;
    const existing = await prisma.aiAnalysis.findFirst({
      where: { uploadId: upload.id, userId: user.id },
    });
    if (existing) { analyses.push(existing); continue; }

    const startedAt = daysAgo(ad.daysAgoN);
    const completedAt = ad.status === "SUCCESS" ? daysAgo(ad.daysAgoN - ad.completedOffset) : null;

    const analysis = await prisma.aiAnalysis.create({
      data: {
        userId: user.id,
        uploadId: upload.id,
        status: ad.status as any,
        modelName: "gemini-2.5-pro",
        promptVersion: "v1",
        resultJson: ad.status === "SUCCESS" ? resultJson : null,
        resultText: ad.status === "SUCCESS" ? JSON.stringify(resultJson) : null,
        errorMessage: ad.status === "FAILED" ? "AI model javobi kutilgan formatda kelmadi." : null,
        tokenUsage: ad.status === "SUCCESS" ? { inputTokens: 4200, outputTokens: 850, totalTokens: 5050 } : null,
        startedAt,
        completedAt,
        createdAt: startedAt,
      },
    });
    analyses.push(analysis);
  }

  console.log(`✓ AI analyses: ${analyses.length}`);

  // ── Dashboard: uploadsOverTime & financialTrend data via AuditLog ──
  // (no separate table — dashboard endpoint aggregates from existing data)
  // So we just make sure uploads are spread over months (already done above)

  console.log("\n✅ Seed yakunlandi!");
  console.log(`   Email:    ${demoUserEmail}`);
  console.log(`   Parol:    ${demoUserPassword}`);
  console.log(`   Fayllar:  ${uploads.length}`);
  console.log(`   Tahlillar: ${analyses.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
