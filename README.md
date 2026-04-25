# bookingbackend

Express 5 + TypeScript + Prisma 7 backend for a financial reporting MVP. The API supports auth, Excel upload and ETL, attribute version history, Vertex AI Gemini analysis, dashboard metrics, report templates, and PDF generation.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill real values.

3. Run Prisma:

```bash
npm run prisma:format
npx prisma migrate dev --name financial_reporting_mvp
npm run prisma:generate
```

4. Optional seed:

```bash
npm run prisma:seed
```

5. Start development server:

```bash
npm run dev
```

## Env

Required environment variables are documented in `.env.example`.

Important:
- Never commit real secrets.
- `DATABASE_URL`, JWT secrets, SMTP password, and Google credentials must come only from environment variables.
- For local Vertex AI auth you can use either:
  - `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`
  - `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...`

## Prisma Migration

Current schema includes:
- `User`
- `Token`
- `UploadedFile`
- `ParsedSheet`
- `ExtractedRow`
- `FinancialAttribute`
- `AttributeVersion`
- `AiAnalysis`
- `ReportTemplate`
- `GeneratedReport`
- `AuditLog`

Run:

```bash
npx prisma migrate dev --name financial_reporting_mvp
```

## Dev Run

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Upload Flow

1. Register or login via `/api/auth/register` or `/api/auth/login`
2. Use `Authorization: Bearer <accessToken>`
3. Upload an Excel/CSV file to `POST /api/files/upload`
4. Backend stores the file metadata, parses sheets and rows, extracts attributes, and writes attribute versions

## AI Analysis Flow

1. Upload and parse a file
2. Trigger analysis:

```http
POST /api/analyses/:uploadId/run
```

3. Backend sends a structured spreadsheet summary to Vertex AI Gemini
4. Analysis JSON or raw text is saved into `AiAnalysis`

## PDF Generation Flow

1. Create or reuse a report template
2. Generate report:

```http
POST /api/reports/generate
```

Payload example:

```json
{
  "templateId": "optional-template-id",
  "uploadId": "optional-upload-id",
  "analysisId": "optional-analysis-id",
  "range": "1m"
}
```

3. PDF is generated with PDFKit and stored in PostgreSQL `Bytes`
4. Download:

```http
GET /api/reports/:id/download
```

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh-token`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:userId/:accessToken`
- `GET /api/auth/me`

### Files
- `POST /api/files/upload`
- `GET /api/files`
- `GET /api/files/:id`
- `DELETE /api/files/:id`

### Analyses
- `POST /api/analyses/:uploadId/run`
- `GET /api/analyses`
- `GET /api/analyses/:id`

### Attributes
- `GET /api/attributes/palette`
- `GET /api/attributes`
- `GET /api/attributes/:id`
- `GET /api/attributes/:id/versions`

### Dashboard
- `GET /api/dashboard/summary?range=1d|1w|1m|1y|10y`
- `GET /api/dashboard/charts?range=1d|1w|1m|1y|10y`
- `GET /api/dashboard/uploads?limit=10`
- `GET /api/dashboard/reports?limit=10`

### Report Templates
- `POST /api/report-templates`
- `GET /api/report-templates`
- `GET /api/report-templates/:id`
- `PATCH /api/report-templates/:id`
- `DELETE /api/report-templates/:id`

### Reports
- `POST /api/reports/generate`
- `GET /api/reports`
- `GET /api/reports/:id`
- `GET /api/reports/:id/download`

## Postman

Team Postman files:
- Collection: [postman/bookingbackend.postman_collection.json](/Users/shaxriyor/Desktop/Berserk/postman/bookingbackend.postman_collection.json:1)
- Environment: [postman/bookingbackend.local.postman_environment.json](/Users/shaxriyor/Desktop/Berserk/postman/bookingbackend.local.postman_environment.json:1)
- Usage guide: [docs/postman.md](/Users/shaxriyor/Desktop/Berserk/docs/postman.md:1)

## Security Notes

- All private routes require `Authorization: Bearer <accessToken>`
- Ownership checks are enforced by `userId`
- Upload validation checks extension, MIME type, and file size
- Global error middleware hides stack traces in production
- Helmet and rate limiting are enabled
- Secrets are never hardcoded

## Google Vertex AI Setup

1. Create a service account with Vertex AI access
2. Download its key JSON file to a safe local path
3. Set:

```env
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.5-pro
```

Optional alternative:

```env
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=base64-encoded-service-account-json
```

## Frontend Integration Notes

This repository currently ships the backend API only. A frontend can integrate using the REST endpoints above for:
- auth
- dashboard widgets
- upload history
- analysis status
- template CRUD
- report generation and PDF download
