import { type EditPlan } from "@ave/core";
import type { CreativeBrief, ReviewScore } from "@ave/core";
export declare function runEditor(plan: EditPlan, footageIndexPath: string, outputDir?: string): Promise<string>;
export declare function refinePlan(plan: EditPlan, footageIndexPath: string): Promise<EditPlan>;
export declare function runReviewer(brief: CreativeBrief, videoPath: string): Promise<ReviewScore>;
