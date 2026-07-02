import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import {
  FootageIndexSchema,
  HttpError,
  type FootageIndex,
  type Shot,
  zodValidationIssues,
} from "@ave/core";
import { scoreShot, searchMoments, tokenize } from "@ave/domain";

const DEFAULT_MIN_RELEVANCE = 0.1;
const DEFAULT_MAX_RESULTS = 20;

function validationError(field: string, message: string, type: string) {
  return [{ loc: ["query", field], msg: message, type }];
}

function sourceFilename(sourceFile: string): string {
  const parts = sourceFile.split(/[/\\]/);
  return parts[parts.length - 1] ?? "";
}

function loadFootageIndex(pathStr: string): FootageIndex {
  try {
    const text = readFileSync(pathStr, "utf-8");
    return FootageIndexSchema.parse(JSON.parse(text));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HttpError(
        404,
        `footage_index_path not found on disk: ${pathStr}`,
      );
    }
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      404,
      err instanceof Error
        ? `footage_index_path unreadable: ${err.message}`
        : `footage_index_path exists but is not a valid FootageIndex`,
    );
  }
}

function shotResult(shot: Shot, relevanceScore?: number) {
  const result: Record<string, unknown> = {
    shot_id: `${shot.source_file}#${shot.start_time}`,
    source_file: shot.source_file,
    source_filename: sourceFilename(shot.source_file),
    start_time: shot.start_time,
    end_time: shot.end_time,
    duration: Math.max(0, shot.end_time - shot.start_time),
    description: shot.description,
    transcript: shot.transcript,
    roll_type: shot.roll_type,
    display_label: `${sourceFilename(shot.source_file)}@${shot.start_time.toFixed(1)}s`,
  };
  if (relevanceScore !== undefined) {
    result.relevance_score = Number(relevanceScore.toFixed(4));
  }
  return result;
}

export const footageRoutes = new Hono();

footageRoutes.get("/catalog", (c) => {
  const footageIndexPath = c.req.query("footage_index_path");
  if (!footageIndexPath) {
    throw new HttpError(422, "footage_index_path is required");
  }

  const index = loadFootageIndex(footageIndexPath);
  const results = index.shots.map((shot) => shotResult(shot));
  return c.json({
    footage_index_path: footageIndexPath,
    count: results.length,
    results,
  });
});

footageRoutes.get("/search", async (c) => {
  const query = c.req.query("query") ?? "";
  const footageIndexPath = c.req.query("footage_index_path");
  const minRelevance = Number(c.req.query("min_relevance") ?? DEFAULT_MIN_RELEVANCE);
  const maxResults = Number(c.req.query("max_results") ?? DEFAULT_MAX_RESULTS);

  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    throw new HttpError(
      422,
      "query must not be empty or whitespace-only",
      validationError("query", "query must not be empty or whitespace-only", "value_error.empty"),
    );
  }
  if (!footageIndexPath) {
    throw new HttpError(422, "footage_index_path is required");
  }

  try {
    const matches = await searchMoments({
      footageIndexPath,
      query: cleanedQuery,
      minRelevance,
      maxResults,
    });

    const queryTokens = tokenize(cleanedQuery);
    const results = matches.map((shot) => shotResult(shot, scoreShot(queryTokens, shot)));

    return c.json({
      query: cleanedQuery,
      footage_index_path: footageIndexPath,
      count: results.length,
      results,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HttpError(
        404,
        `footage_index_path not found on disk: ${footageIndexPath}`,
      );
    }
    if (err instanceof z.ZodError) {
      throw new HttpError(
        404,
        `footage_index_path exists but is not a valid FootageIndex: ${JSON.stringify(zodValidationIssues(err).slice(0, 3))}`,
      );
    }
    throw err;
  }
});
