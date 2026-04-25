import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function sha256(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

export async function sha256File(filePath: string) {
  const hash = createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  return hash.digest("hex");
}
