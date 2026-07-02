import { getSettings } from "@ave/core";

export const REPO_ROOT = getSettings().repoRoot;
export const OUTPUT_DIR = getSettings().outputDir;
export const STYLES_DIR = `${REPO_ROOT}/styles`;
export const PIPELINES_DIR = `${REPO_ROOT}/pipelines`;
