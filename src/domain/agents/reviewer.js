import { readFileSync } from "node:fs";
import { ReviewScoreSchema } from "@ave/core";
import { getSettings } from "@ave/core";
const GEMINI_MODEL = "gemini-2.0-flash";
function requireApiKey() {
    const key = getSettings().googleApiKey ?? process.env.GOOGLE_API_KEY;
    if (!key) {
        throw new Error("GOOGLE_API_KEY is required");
    }
    return key;
}
export async function reviewVideo(brief, videoPath) {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: requireApiKey() });
    const videoBytes = readFileSync(videoPath);
    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
            {
                role: "user",
                parts: [
                    {
                        inlineData: {
                            mimeType: "video/mp4",
                            data: videoBytes.toString("base64"),
                        },
                    },
                    {
                        text: [
                            "Review this ad cut against the creative brief.",
                            JSON.stringify(brief),
                            "Return JSON with adherence, pacing, visual_quality, watchability, overall (0-1), and feedback string.",
                        ].join("\n"),
                    },
                ],
            },
        ],
        config: {
            responseMimeType: "application/json",
        },
    });
    const text = response.text?.trim();
    if (!text) {
        throw new Error("Reviewer returned empty response");
    }
    return ReviewScoreSchema.parse(JSON.parse(text));
}
