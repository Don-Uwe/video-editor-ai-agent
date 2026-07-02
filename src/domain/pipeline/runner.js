import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { runDirector } from "../agents/director";
import { runEditor, refinePlan, runReviewer } from "../agents/editor";
const TRANSIENT_DELAYS_MS = [30_000, 60_000, 120_000];
export async function withTransientRetry(fn, ...args) {
    let lastError;
    for (const delay of TRANSIENT_DELAYS_MS) {
        try {
            return await fn(...args);
        }
        catch (error) {
            lastError = error;
            await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
        }
    }
    if (lastError instanceof Error)
        throw lastError;
    throw new Error("Transient retry failed");
}
function loadManifest(pipelinePath) {
    const raw = parseYaml(readFileSync(pipelinePath, "utf8"));
    if (!raw.steps?.length) {
        throw new Error(`Pipeline manifest has no steps: ${pipelinePath}`);
    }
    return raw;
}
function reviewFailed(review, retryIf) {
    const value = review[retryIf.metric];
    if (typeof value !== "number")
        return false;
    return retryIf.operator === "<="
        ? value <= retryIf.threshold
        : value < retryIf.threshold;
}
export async function runPipeline(options) {
    const manifest = loadManifest(options.pipelinePath);
    const warnings = [];
    const feedbackHistory = [];
    let editPlan = null;
    let finalVideoPath = null;
    let review = null;
    let retriesUsed = 0;
    const reviewerStep = manifest.steps.find((step) => step.agent === "reviewer");
    const maxRetries = reviewerStep?.retry_if?.max_retries ?? 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        for (const step of manifest.steps) {
            if (step.agent === "director") {
                const feedback = feedbackHistory.join("\n\n");
                editPlan = await withTransientRetry(() => runDirector(options.brief, options.footageIndexPath, feedback || undefined));
            }
            else if (step.agent === "trim_refiner" && editPlan) {
                editPlan = await withTransientRetry(() => refinePlan(editPlan, options.footageIndexPath));
            }
            else if (step.agent === "editor" && editPlan) {
                finalVideoPath = await withTransientRetry(() => runEditor(editPlan, options.footageIndexPath, options.outputDir));
            }
            else if (step.agent === "reviewer" && finalVideoPath) {
                review = await withTransientRetry(() => runReviewer(options.brief, finalVideoPath));
            }
        }
        if (!reviewerStep?.retry_if || !review || !reviewFailed(review, reviewerStep.retry_if)) {
            break;
        }
        if (attempt >= maxRetries) {
            warnings.push(`Review score below threshold after ${maxRetries} retries`);
            break;
        }
        feedbackHistory.push(review.feedback);
        retriesUsed += 1;
    }
    return {
        editPlan,
        finalVideoPath,
        review,
        retriesUsed,
        warnings,
        feedbackHistory,
    };
}
export async function runDirectorWithFeedback(brief, footageIndexPath, feedback) {
    return runDirector(brief, footageIndexPath, feedback);
}
export { preprocessFootage } from "./preprocess";
export { searchMoments, tokenize, scoreShot } from "../tools/analyze";
export { runEditor, refinePlan, runReviewer } from "../agents/editor";
export { slugifyBrief } from "../utils/paths";
