import { z } from "zod";

export const rangeSchema = z.enum(["1d", "1w", "1m", "1y", "10y"]).default("1m");

export type RangeKey = z.infer<typeof rangeSchema>;

export function getRangeStart(range: RangeKey, now = new Date()) {
  const start = new Date(now);

  switch (range) {
    case "1d":
      start.setDate(start.getDate() - 1);
      break;
    case "1w":
      start.setDate(start.getDate() - 7);
      break;
    case "1m":
      start.setDate(start.getDate() - 30);
      break;
    case "1y":
      start.setDate(start.getDate() - 365);
      break;
    case "10y":
      start.setDate(start.getDate() - 3650);
      break;
  }

  return start;
}

export function getRangeBucket(range: RangeKey) {
  return range === "1d" || range === "1w" ? "day" : "month";
}

export function formatBucket(date: Date, bucket: "day" | "month") {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return bucket === "day" ? `${year}-${month}-${day}` : `${year}-${month}`;
}
