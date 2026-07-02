import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "apps/**/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@ave/core": path.resolve(__dirname, "src/core/index.ts"),
      "@ave/domain": path.resolve(__dirname, "src/domain/index.ts"),
    },
  },
});
