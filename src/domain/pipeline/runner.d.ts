import { type CreativeBrief, type EditPlan, type ReviewScore } from "@ave/core";
export interface PipelineResult {
    editPlan: EditPlan | null;
    finalVideoPath: string | null;
    review: ReviewScore | null;
    retriesUsed: number;
    warnings: string[];
    feedbackHistory: string[];
}
export declare function withTransientRetry<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>, ...args: TArgs): Promise<TResult>;
export declare function runPipeline(options: {
    pipelinePath: string;
    brief: CreativeBrief;
    footageIndexPath: string;
    humanApproval?: boolean;
    outputDir?: string;
}): Promise<PipelineResult>;
export declare function runDirectorWithFeedback(brief: CreativeBrief, footageIndexPath: string, feedback: string): Promise<EditPlan>;
export { preprocessFootage } from "./preprocess";
export { searchMoments, tokenize, scoreShot } from "../tools/analyze";
export { runEditor, refinePlan, runReviewer } from "../agents/editor";
export { slugifyBrief } from "../utils/paths";
