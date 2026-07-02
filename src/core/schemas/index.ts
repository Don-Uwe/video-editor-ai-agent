import { z } from "zod";

export const CreativeBriefSchema = z.object({
  product: z.string(),
  audience: z.string(),
  tone: z.string(),
  duration_seconds: z.number(),
  style_ref: z.string().nullable().optional().default(null),
});

export const WordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const ShotSchema = z.object({
  source_file: z.string(),
  start_time: z.number(),
  end_time: z.number(),
  description: z.string(),
  energy_level: z.number(),
  relevance_score: z.number(),
  transcript: z.string(),
  words: z.array(WordTimestampSchema).optional().default([]),
  roll_type: z.string().optional().default("unknown"),
});

export const FootageIndexSchema = z.object({
  source_dir: z.string(),
  shots: z.array(ShotSchema),
  total_duration: z.number(),
  created_at: z.union([z.string(), z.coerce.date()]),
});

export const EditPlanEntrySchema = z.object({
  shot_id: z.string(),
  start_trim: z.number(),
  end_trim: z.number(),
  position: z.number(),
  text_overlay: z.string().nullable().optional().default(null),
  transition: z.string().nullable().optional().default(null),
});

export const EditPlanSchema = z.object({
  brief: CreativeBriefSchema,
  entries: z.array(EditPlanEntrySchema),
  music_path: z.string().nullable().optional().default(null),
  total_duration: z.number(),
});

export const ReviewScoreSchema = z.object({
  adherence: z.number(),
  pacing: z.number(),
  visual_quality: z.number(),
  watchability: z.number(),
  overall: z.number(),
  feedback: z.string(),
});

export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type FootageIndex = z.infer<typeof FootageIndexSchema>;
export type EditPlanEntry = z.infer<typeof EditPlanEntrySchema>;
export type EditPlan = z.infer<typeof EditPlanSchema>;
export type ReviewScore = z.infer<typeof ReviewScoreSchema>;

export type ValidationIssue = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export function zodValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    loc: issue.path,
    msg: issue.message,
    type: issue.code,
  }));
}
