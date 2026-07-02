import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function ensureParentDir(output: string): void {
  mkdirSync(dirname(output), { recursive: true });
}

export function slugifyBrief(product: string): string {
  const slug = product
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "brief";
}
