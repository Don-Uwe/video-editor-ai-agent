import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function ensureParentDir(output) {
    mkdirSync(dirname(output), { recursive: true });
}
export function slugifyBrief(product) {
    const slug = product
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "brief";
}
