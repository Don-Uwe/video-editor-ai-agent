#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CreativeBriefSchema } from "@ave/core";
import { loadConfig } from "@ave/core";
import { createLogger } from "@ave/core";
import { preprocessFootage, runPipeline } from "@ave/domain";

const logger = createLogger("cli");

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = { edit: argv.includes("edit") };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function parseBrief(raw: string) {
  try {
    return CreativeBriefSchema.parse(JSON.parse(raw));
  } catch {
    const file = resolve(raw);
    return CreativeBriefSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  }
}

async function main(): Promise<void> {
  loadConfig();
  const args = parseArgs(process.argv.slice(2));
  if (!args.edit) {
    console.log("Usage: ave edit --footage-dir <dir> --brief <json|file> [--pipeline <yaml>]");
    process.exit(1);
  }

  const footageDir = String(args["footage-dir"] ?? "");
  const briefRaw = String(args.brief ?? "");
  const pipelinePath = String(args.pipeline ?? "pipelines/ugc-ad.yaml");

  if (!footageDir || !briefRaw) {
    throw new Error("--footage-dir and --brief are required");
  }

  const config = loadConfig();
  const brief = parseBrief(briefRaw);
  const indexPath = resolve(config.outputDir, "footage_index.json");

  logger.info("Preprocessing footage", { footageDir, indexPath });
  await preprocessFootage({ inputDir: footageDir, outputPath: indexPath });

  logger.info("Running pipeline", { pipelinePath });
  const result = await runPipeline({
    pipelinePath,
    brief,
    footageIndexPath: indexPath,
    outputDir: config.outputDir,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  logger.error("CLI failed", { error: String(error) });
  process.exit(1);
});
