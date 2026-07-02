import { z } from "zod";
export declare const CreativeBriefSchema: z.ZodObject<{
    product: z.ZodString;
    audience: z.ZodString;
    tone: z.ZodString;
    duration_seconds: z.ZodNumber;
    style_ref: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    product: string;
    audience: string;
    tone: string;
    duration_seconds: number;
    style_ref: string | null;
}, {
    product: string;
    audience: string;
    tone: string;
    duration_seconds: number;
    style_ref?: string | null | undefined;
}>;
export declare const WordTimestampSchema: z.ZodObject<{
    word: z.ZodString;
    start: z.ZodNumber;
    end: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    word: string;
    start: number;
    end: number;
}, {
    word: string;
    start: number;
    end: number;
}>;
export declare const ShotSchema: z.ZodObject<{
    source_file: z.ZodString;
    start_time: z.ZodNumber;
    end_time: z.ZodNumber;
    description: z.ZodString;
    energy_level: z.ZodNumber;
    relevance_score: z.ZodNumber;
    transcript: z.ZodString;
    words: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        word: z.ZodString;
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        word: string;
        start: number;
        end: number;
    }, {
        word: string;
        start: number;
        end: number;
    }>, "many">>>;
    roll_type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    source_file: string;
    start_time: number;
    end_time: number;
    description: string;
    energy_level: number;
    relevance_score: number;
    transcript: string;
    words: {
        word: string;
        start: number;
        end: number;
    }[];
    roll_type: string;
}, {
    source_file: string;
    start_time: number;
    end_time: number;
    description: string;
    energy_level: number;
    relevance_score: number;
    transcript: string;
    words?: {
        word: string;
        start: number;
        end: number;
    }[] | undefined;
    roll_type?: string | undefined;
}>;
export declare const FootageIndexSchema: z.ZodObject<{
    source_dir: z.ZodString;
    shots: z.ZodArray<z.ZodObject<{
        source_file: z.ZodString;
        start_time: z.ZodNumber;
        end_time: z.ZodNumber;
        description: z.ZodString;
        energy_level: z.ZodNumber;
        relevance_score: z.ZodNumber;
        transcript: z.ZodString;
        words: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            word: z.ZodString;
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            word: string;
            start: number;
            end: number;
        }, {
            word: string;
            start: number;
            end: number;
        }>, "many">>>;
        roll_type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        source_file: string;
        start_time: number;
        end_time: number;
        description: string;
        energy_level: number;
        relevance_score: number;
        transcript: string;
        words: {
            word: string;
            start: number;
            end: number;
        }[];
        roll_type: string;
    }, {
        source_file: string;
        start_time: number;
        end_time: number;
        description: string;
        energy_level: number;
        relevance_score: number;
        transcript: string;
        words?: {
            word: string;
            start: number;
            end: number;
        }[] | undefined;
        roll_type?: string | undefined;
    }>, "many">;
    total_duration: z.ZodNumber;
    created_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
}, "strip", z.ZodTypeAny, {
    source_dir: string;
    shots: {
        source_file: string;
        start_time: number;
        end_time: number;
        description: string;
        energy_level: number;
        relevance_score: number;
        transcript: string;
        words: {
            word: string;
            start: number;
            end: number;
        }[];
        roll_type: string;
    }[];
    total_duration: number;
    created_at: string | Date;
}, {
    source_dir: string;
    shots: {
        source_file: string;
        start_time: number;
        end_time: number;
        description: string;
        energy_level: number;
        relevance_score: number;
        transcript: string;
        words?: {
            word: string;
            start: number;
            end: number;
        }[] | undefined;
        roll_type?: string | undefined;
    }[];
    total_duration: number;
    created_at: string | Date;
}>;
export declare const EditPlanEntrySchema: z.ZodObject<{
    shot_id: z.ZodString;
    start_trim: z.ZodNumber;
    end_trim: z.ZodNumber;
    position: z.ZodNumber;
    text_overlay: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    transition: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    shot_id: string;
    start_trim: number;
    end_trim: number;
    position: number;
    text_overlay: string | null;
    transition: string | null;
}, {
    shot_id: string;
    start_trim: number;
    end_trim: number;
    position: number;
    text_overlay?: string | null | undefined;
    transition?: string | null | undefined;
}>;
export declare const EditPlanSchema: z.ZodObject<{
    brief: z.ZodObject<{
        product: z.ZodString;
        audience: z.ZodString;
        tone: z.ZodString;
        duration_seconds: z.ZodNumber;
        style_ref: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, "strip", z.ZodTypeAny, {
        product: string;
        audience: string;
        tone: string;
        duration_seconds: number;
        style_ref: string | null;
    }, {
        product: string;
        audience: string;
        tone: string;
        duration_seconds: number;
        style_ref?: string | null | undefined;
    }>;
    entries: z.ZodArray<z.ZodObject<{
        shot_id: z.ZodString;
        start_trim: z.ZodNumber;
        end_trim: z.ZodNumber;
        position: z.ZodNumber;
        text_overlay: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        transition: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, "strip", z.ZodTypeAny, {
        shot_id: string;
        start_trim: number;
        end_trim: number;
        position: number;
        text_overlay: string | null;
        transition: string | null;
    }, {
        shot_id: string;
        start_trim: number;
        end_trim: number;
        position: number;
        text_overlay?: string | null | undefined;
        transition?: string | null | undefined;
    }>, "many">;
    music_path: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    total_duration: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    entries: {
        shot_id: string;
        start_trim: number;
        end_trim: number;
        position: number;
        text_overlay: string | null;
        transition: string | null;
    }[];
    total_duration: number;
    brief: {
        product: string;
        audience: string;
        tone: string;
        duration_seconds: number;
        style_ref: string | null;
    };
    music_path: string | null;
}, {
    entries: {
        shot_id: string;
        start_trim: number;
        end_trim: number;
        position: number;
        text_overlay?: string | null | undefined;
        transition?: string | null | undefined;
    }[];
    total_duration: number;
    brief: {
        product: string;
        audience: string;
        tone: string;
        duration_seconds: number;
        style_ref?: string | null | undefined;
    };
    music_path?: string | null | undefined;
}>;
export declare const ReviewScoreSchema: z.ZodObject<{
    adherence: z.ZodNumber;
    pacing: z.ZodNumber;
    visual_quality: z.ZodNumber;
    watchability: z.ZodNumber;
    overall: z.ZodNumber;
    feedback: z.ZodString;
}, "strip", z.ZodTypeAny, {
    adherence: number;
    pacing: number;
    visual_quality: number;
    watchability: number;
    overall: number;
    feedback: string;
}, {
    adherence: number;
    pacing: number;
    visual_quality: number;
    watchability: number;
    overall: number;
    feedback: string;
}>;
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
export declare function zodValidationIssues(error: z.ZodError): ValidationIssue[];
