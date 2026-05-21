import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves the `@/*` alias from tsconfig.json natively.
    tsconfigPaths: true,
  },
  test: {
    coverage: {
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
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      // Per-layer thresholds. Hard fail in CI + pre-push.
      // Repo-wide floor is the top-level entry; specific paths override.
      thresholds: {
        branches: 78,
        functions: 84,
        lines: 85,
        "src/app/api/**": {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "src/components/**": {
          branches: 76,
          functions: 86,
          lines: 88,
          statements: 84,
        },
        "src/lib/**": {
          branches: 90,
          functions: 96,
          lines: 98,
          statements: 96,
        },
        "src/lib/use*.ts": {
          // Branches here include SSR guards (isBrowser()) whose `false`
          // case can't be hit without simulating Node-side rendering;
          // the rest of the file targets stay tight.
          branches: 75,
          functions: 90,
          lines: 95,
          statements: 90,
        },
        statements: 88,
      },
    },
    css: false,
    environment: "happy-dom",
    exclude: ["node_modules", "tests/e2e/**", ".next/**", "dist/**"],
    globals: true,
    // Vitest discovers tests anywhere under src/; E2E specs live in
    // tests/e2e/ and are owned by the Playwright runner.
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-utils/setup.ts"],
  },
});
