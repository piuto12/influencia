import { defineConfig } from "vitest/config";

// HTTP smoke tests against a RUNNING server (E2E_BASE_URL, default http://localhost:3000). Run: npm run build && npm start, then npm run test:e2e
export default defineConfig({ test: { include: ["tests/e2e/**/*.e2e.ts"], testTimeout: 20000 } });
