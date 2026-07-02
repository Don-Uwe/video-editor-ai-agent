import { readFileSync } from "node:fs";
import { HttpError } from "@ave/core";
import {
  EditPlanSchema,
  FootageIndexSchema,
  type EditPlan,
  type FootageIndex,
  type ValidationIssue,
  zodValidationIssues,
} from "@ave/core";

export const SHOT_MATCH_EPSILON = 1e-3;
export const TRIM_EPSILON = 1e-3;

export function validationIssue(
  loc: (string | number)[],
  message: string,
  type: string,
): ValidationIssue {
  return { loc, msg: message, type };
}

export function loadFootageIndexOr422(pathStr: string | null | undefined): FootageIndex {
  if (!pathStr) {
    throw new HttpError(
      422,
      "job has no footage_index_path; cannot validate edit plan",
      [
        validationIssue(
          ["job", "footage_index_path"],
          "job has no footage_index_path; cannot validate edit plan",
          "value_error.missing",
        ),
      ],
    );
  }

  try {
    const text = readFileSync(pathStr, "utf-8");
    return FootageIndexSchema.parse(JSON.parse(text));
  } catch (err) {
    if (err instanceof HttpError) throw err;

    const message =
      err instanceof Error && "code" in err && err.code === "ENOENT"
        ? `footage_index_path not found on disk: ${pathStr}`
        : err instanceof Error
          ? `footage_index_path unreadable: ${err.message}`
          : `footage_index_path exists but is not a valid FootageIndex`;

    throw new HttpError(422, message, [
      validationIssue(
        ["job", "footage_index_path"],
        message,
        "value_error.footage_index_invalid",
      ),
    ]);
  }
}

export function resolveShot(
  shotId: string,
  index: FootageIndex,
): (typeof index.shots)[number] | null {
  const sep = shotId.lastIndexOf("#");
  if (sep === -1) return null;

  const sourceFile = shotId.slice(0, sep);
  const suffix = shotId.slice(sep + 1);
  const startTime = Number.parseFloat(suffix);
  if (Number.isNaN(startTime)) return null;

  for (const shot of index.shots) {
    if (
      shot.source_file === sourceFile &&
      Math.abs(shot.start_time - startTime) < SHOT_MATCH_EPSILON
    ) {
      return shot;
    }
  }
  return null;
}

export function validateEditPlanAgainstIndex(
  plan: EditPlan,
  index: FootageIndex,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const entries = [...plan.entries];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const shot = resolveShot(entry.shot_id, index);

    if (!shot) {
      errors.push(
        validationIssue(
          ["body", "entries", i, "shot_id"],
          `shot_id ${JSON.stringify(entry.shot_id)} does not resolve to any shot in the footage index`,
          "value_error.shot_not_found",
        ),
      );
      continue;
    }

    if (entry.start_trim > entry.end_trim + TRIM_EPSILON) {
      errors.push(
        validationIssue(
          ["body", "entries", i, "start_trim"],
          `start_trim (${entry.start_trim}) must be <= end_trim (${entry.end_trim})`,
          "value_error.trim_order",
        ),
      );
      continue;
    }

    if (entry.start_trim < shot.start_time - TRIM_EPSILON) {
      errors.push(
        validationIssue(
          ["body", "entries", i, "start_trim"],
          `start_trim (${entry.start_trim}) is before shot start_time (${shot.start_time})`,
          "value_error.trim_out_of_bounds",
        ),
      );
    }
    if (entry.start_trim > shot.end_time + TRIM_EPSILON) {
      errors.push(
        validationIssue(
          ["body", "entries", i, "start_trim"],
          `start_trim (${entry.start_trim}) is after shot end_time (${shot.end_time})`,
          "value_error.trim_out_of_bounds",
        ),
      );
    }
    if (entry.end_trim < shot.start_time - TRIM_EPSILON) {
      errors.push(
        validationIssue(
          ["body", "entries", i, "end_trim"],
          `end_trim (${entry.end_trim}) is before shot start_time (${shot.start_time})`,
          "value_error.trim_out_of_bounds",
        ),
      );
    }
    if (entry.end_trim > shot.end_time + TRIM_EPSILON) {
      errors.push(
        validationIssue(
          ["body", "entries", i, "end_trim"],
          `end_trim (${entry.end_trim}) is after shot end_time (${shot.end_time})`,
          "value_error.trim_out_of_bounds",
        ),
      );
    }
  }

  const positions = entries.map((entry) => entry.position).sort((a, b) => a - b);
  const expected = entries.map((_, index) => index);
  if (JSON.stringify(positions) !== JSON.stringify(expected)) {
    errors.push(
      validationIssue(
        ["body", "entries"],
        `positions must form a contiguous 0..N-1 sequence (got ${JSON.stringify(positions)}, expected ${JSON.stringify(expected)})`,
        "value_error.positions_not_contiguous",
      ),
    );
  }

  return errors;
}

export function parseEditPlanPayload(payload: unknown): EditPlan {
  const parsed = EditPlanSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(422, "Invalid edit plan", zodValidationIssues(parsed.error));
  }
  return parsed.data;
}
