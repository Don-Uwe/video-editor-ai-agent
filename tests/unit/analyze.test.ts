import { describe, expect, it } from "vitest";

import { scoreShot, tokenize } from "@ave/domain";

describe("analyze", () => {
  it("scores shots by token overlap", () => {
    const tokens = tokenize("authentic product review");
    const score = scoreShot(tokens, {
      source_file: "/footage/a.mp4",
      start_time: 0,
      end_time: 5,
      description: "authentic product testimonial",
      energy_level: 3,
      relevance_score: 0,
      transcript: "I love this product",
      words: [],
      roll_type: "a-roll",
    });
    expect(score).toBeGreaterThan(0);
  });
});
