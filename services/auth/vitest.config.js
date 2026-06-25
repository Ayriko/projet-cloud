import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { NODE_ENV: "test", JWT_SECRET: "test-secret" },
  },
});
