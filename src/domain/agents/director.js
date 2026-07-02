import { CreativeBriefSchema, EditPlanSchema, } from "@ave/core";
import { getSettings } from "@ave/core";
import { searchMoments } from "../tools/analyze";
const GEMINI_MODEL = "gemini-2.0-flash";
function requireApiKey() {
    const key = getSettings().googleApiKey ?? process.env.GOOGLE_API_KEY;
    if (!key) {
        throw new Error("GOOGLE_API_KEY is required");
    }
    return key;
}
export async function runDirector(brief, footageIndexPath, feedback) {
    CreativeBriefSchema.parse(brief);
    const candidates = searchMoments({
        footageIndexPath,
        query: `${brief.product} ${brief.audience} ${brief.tone}`,
        minRelevance: 0.1,
        maxResults: Math.max(4, Math.ceil(brief.duration_seconds / 5)),
    });
    if (candidates.length === 0) {
        throw new Error("No footage candidates matched the creative brief");
    }
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: requireApiKey() });
    const prompt = [
        "You are a video director. Build a JSON edit plan for a short ad.",
        `Brief: ${JSON.stringify(brief)}`,
        feedback ? `Reviewer feedback to address:\n${feedback}` : "",
        "Candidate shots:",
        JSON.stringify(candidates.map((shot) => ({
            shot_id: `${shot.source_file}#${shot.start_time}`,
            description: shot.description,
            duration: shot.end_time - shot.start_time,
            roll_type: shot.roll_type,
        })), null, 2),
        "Return ONLY valid JSON matching EditPlan schema with entries using shot_id from candidates.",
    ]
        .filter(Boolean)
        .join("\n\n");
    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    brief: { type: "object" },
                    entries: { type: "array" },
                    music_path: { type: "string", nullable: true },
                    total_duration: { type: "number" },
                },
                required: ["brief", "entries", "total_duration"],
            },
        },
    });
    const text = response.text?.trim();
    if (!text) {
        throw new Error("Director returned empty response");
    }
    const parsed = EditPlanSchema.parse(JSON.parse(text));
    return { ...parsed, brief };
}
