import { readFileSync } from "node:fs";
import { FootageIndexSchema, } from "@ave/core";
const STOPWORDS = new Set(["a", "an", "the", "of", "to", "and", "or"]);
export function tokenize(text) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}
export function scoreShot(queryTokens, shot) {
    if (queryTokens.length === 0)
        return 0;
    const haystack = [
        shot.description,
        shot.transcript,
        shot.roll_type,
        shot.source_file,
    ]
        .join(" ")
        .toLowerCase();
    const hits = queryTokens.filter((token) => haystack.includes(token)).length;
    return hits / queryTokens.length;
}
export function loadFootageIndex(path) {
    const raw = readFileSync(path, "utf8");
    return FootageIndexSchema.parse(JSON.parse(raw));
}
export function searchMoments(options) {
    const index = loadFootageIndex(options.footageIndexPath);
    const queryTokens = tokenize(options.query);
    const minRelevance = options.minRelevance ?? 0;
    const maxResults = options.maxResults ?? 20;
    return index.shots
        .map((shot) => ({ shot, score: scoreShot(queryTokens, shot) }))
        .filter(({ score }) => score >= minRelevance)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(({ shot, score }) => ({ ...shot, relevance_score: score }));
}
