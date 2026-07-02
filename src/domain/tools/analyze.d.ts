import { type FootageIndex, type Shot } from "@ave/core";
export declare function tokenize(text: string): string[];
export declare function scoreShot(queryTokens: string[], shot: Shot): number;
export declare function loadFootageIndex(path: string): FootageIndex;
export declare function searchMoments(options: {
    footageIndexPath: string;
    query: string;
    minRelevance?: number;
    maxResults?: number;
}): Shot[];
