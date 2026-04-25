export function normalizeDatabaseUrl(rawDatabaseUrl: string) {
  const url = new URL(rawDatabaseUrl);
  const hostname = url.hostname.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  if (isLocalHost) {
    url.searchParams.set("sslmode", "disable");
    return url.toString();
  }

  if (!url.searchParams.has("sslmode") && rawDatabaseUrl.includes("render.com")) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}
