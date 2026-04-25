# Postman Usage

## Files

- Collection: [postman/bookingbackend.postman_collection.json](/Users/shaxriyor/Desktop/Berserk/postman/bookingbackend.postman_collection.json:1)
- Environment: [postman/bookingbackend.local.postman_environment.json](/Users/shaxriyor/Desktop/Berserk/postman/bookingbackend.local.postman_environment.json:1)

## Import

1. Open Postman.
2. Click `Import`.
3. Import the collection JSON.
4. Import the environment JSON.
5. Select the `bookingbackend local` environment.

## Before First Use

Set these environment values:

- `baseUrl`
  Example: `http://localhost:3000`
- `userEmail`
- `userPassword`
- `userName`
- `excelFilePath`
  Example: `/absolute/path/to/sample.xlsx`
- `range`
  Allowed: `1d`, `1w`, `1m`, `1y`, `10y`

Do not store real production secrets in the exported environment file.

## Recommended Team Flow

1. Run backend locally with `npm run dev`.
2. In Postman, run `Auth > Register` once for a new user.
3. Run `Auth > Login`.
   The collection test script automatically stores:
   - `accessToken`
   - `refreshToken`
   - `userId`
4. Run `Files > Upload File`.
   The test script stores `uploadId`.
5. Run `AI > Run Analysis`.
   The test script stores `analysisId`.
6. Run `Report Templates > Create Template`.
   The test script stores `templateId`.
7. Run `Reports > Generate Report`.
   The test script stores `reportId`.
8. Run:
   - `Dashboard > Summary`
   - `Dashboard > Charts`
   - `Reports > Download Report PDF`

## Auto-Saved Variables

These variables are captured automatically from API responses:

- `accessToken`
- `refreshToken`
- `userId`
- `uploadId`
- `analysisId`
- `attributeId`
- `templateId`
- `reportId`

## Notes For File Upload

- Postman Desktop is recommended for file upload testing.
- In `Files > Upload File`, confirm the file picker points to a real `.xlsx`, `.xls`, or `.csv` file.
- If Postman does not resolve `{{excelFilePath}}` for upload, re-select the file manually in the form-data row.

## Useful Request Order

### Auth

- `Register`
- `Login`
- `Me`
- `Refresh Token`

### File and ETL

- `Upload File`
- `List Files`
- `Get File By Id`

### Analysis

- `Run Analysis`
- `List Analyses`
- `Get Analysis By Id`

### Attributes

- `Palette`
- `List Attributes`
- `Get Attribute By Id`
- `Get Attribute Versions`

### Dashboard

- `Summary`
- `Charts`
- `Recent Uploads`
- `Recent Reports`

### Reports

- `Create Template`
- `Generate Report`
- `Get Report By Id`
- `Download Report PDF`

## Troubleshooting

- `401 Unauthorized`
  Run `Auth > Login` again and confirm `accessToken` is populated.
- `404` on `{{uploadId}}`, `{{analysisId}}`, `{{templateId}}`, or `{{reportId}}`
  Run the earlier request that creates that resource again.
- `Upload failed`
  Check file extension, MIME type, and file size limit.
- `AI analysis failed`
  Check Vertex AI env vars and Google credentials on the backend.
- `PDF generate failed`
  Make sure at least one valid upload exists and auth token belongs to the same user.
