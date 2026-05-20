import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves the `@/*` alias from tsconfig.json natively.
    tsconfigPaths: true,
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test-utils/setup.ts"],
    css: false,
    // Vitest discovers tests anywhere under src/; E2E specs live in
    // tests/e2e/ and are owned by the Playwright runner.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "tests/e2e/**", ".next/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test-utils/**",
        // Mockups are scratch — removed/replaced frequently, not user-facing.
        "src/components/mockups/**",
        "src/app/mockups/**",
        // Layout/boilerplate that doesn't carry interesting logic.
        "src/app/layout.tsx",
        "src/components/ServiceWorkerRegister.tsx",
      ],
      // Per-layer thresholds. Hard fail in CI + pre-push.
      // Repo-wide floor is the top-level entry; specific paths override.
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
        "src/lib/**": {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
        "src/app/api/**": {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
        "src/lib/use*.ts": {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85,
        },
        "src/components/**": {
          lines: 70,
          branches: 65,
          functions: 70,
          statements: 70,
        },
      },
    },
  },
});
