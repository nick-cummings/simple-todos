import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
    // Next.js core + TypeScript recommended (kept for the Next-specific
    // rules from @next/eslint-plugin-next; the typescript-eslint pieces
    // will be superseded by our stricter layers below).
    ...nextVitals,
    ...nextTs,

    // Strictest typescript-eslint set + stylistic-type-checked. These
    // require type information, so we enable the project service so the
    // parser can resolve types without us hand-listing every tsconfig.
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // Cross-cutting plugins.
    unicorn.configs["flat/recommended"],
    perfectionist.configs["recommended-natural"],
    security.configs.recommended,
    sonarjs.configs.recommended,

    // Manual tightenings beyond the canned configs + domain-specific
    // overrides that always apply.
    {
        rules: {
            "@typescript-eslint/no-unnecessary-condition": [
                "error",
                { allowConstantLoopConditions: true },
            ],
            // Template literals with numbers/booleans are everywhere
            // (IDs, counts, coords). Forcing String(n) is needless ceremony.
            "@typescript-eslint/restrict-template-expressions": [
                "error",
                { allowBoolean: true, allowNumber: true },
            ],
            eqeqeq: ["error", "always"],
            "max-lines": [
                "error",
                { max: 500, skipBlankLines: true, skipComments: true },
            ],
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "no-implicit-coercion": "error",
            "no-nested-ternary": "error",

            "no-param-reassign": ["error", { props: false }],

            "prefer-template": "error",

            // Same plugin, similar noise on hex-color regex etc.
            "security/detect-non-literal-regexp": "off",

            // security/detect-object-injection is famous for false positives
            // on any computed access (m[key], obj[name]). The codebase has
            // no eval-shaped surfaces; leave it off and rely on TS for
            // type safety on property access.
            "security/detect-object-injection": "off",
            // Disable the no-fixme companion for the same reason (we use
            // FIXME for real things; the noise would drown signal).
            "sonarjs/fixme-tag": "off",
            // React props are conventionally immutable already; the linter
            // doesn't add safety here beyond verbose Readonly<Props> types.
            "sonarjs/prefer-read-only-props": "off",
            // This is a TODOS app — the word "TODO" appears throughout
            // identifiers, comments, and test names. Disable the literal-
            // string detection rule.
            "sonarjs/todo-tag": "off",
            // Hook subscribe/cleanup pairs intentionally create their listener
            // inside the function so each subscriber gets its own reference
            // (matters for addEventListener/removeEventListener pairing).
            "unicorn/consistent-function-scoping": "off",
            // React conventionally uses PascalCase for component files; the
            // entire codebase follows that. The unicorn kebab-case rule would
            // force a mass rename that fights every other React project on
            // earth.
            "unicorn/filename-case": "off",
            // Allow `null` — we interop with web APIs that require it.
            "unicorn/no-null": "off",
            // `typeof window === "undefined"` is the universal SSR guard.
            // Rewriting it to `window === undefined` throws ReferenceError
            // at runtime in Node, and TS types `window` as never undefined
            // so both this rule and TS's no-unnecessary-condition fight us
            // here. Keep the typeof form intact.
            "unicorn/no-typeof-undefined": "off",
            // 'next' is a reserved-ish word in Next.js patterns and a
            // common variable name; the abbrev rule fights this.
            "unicorn/prevent-abbreviations": "off",
        },
    },

    // Type-aware lint barfs on plain .js / .mjs (no tsconfig owns them).
    // Disable type-checked rules for those files.
    {
        extends: [tseslint.configs.disableTypeChecked],
        files: ["**/*.{js,mjs,cjs}"],
    },

    // Test files need more freedom: mocks, unsafe casts, magic strings.
    {
        files: [
            "**/*.test.{ts,tsx}",
            "tests/**/*.{ts,tsx}",
            "src/test-utils/**/*",
        ],
        rules: {
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-extraneous-class": "off",
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unnecessary-type-assertion": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/unbound-method": "off",
            // Test files frequently group many small integration cases —
            // splitting them across files is more friction than signal.
            "max-lines": "off",
            "no-console": "off",
            "security/detect-non-literal-regexp": "off",
            "security/detect-object-injection": "off",
            "sonarjs/cognitive-complexity": "off",
            "sonarjs/different-types-comparison": "off",
            // Test-only Error Boundary implementations return ReactNode but
            // SonarJS sees the JSX/children branches as different shapes.
            "sonarjs/function-return-type": "off",
            "sonarjs/no-alphabetical-sort": "off",
            "sonarjs/no-duplicate-string": "off",
            "sonarjs/no-hardcoded-ip": "off",
            "sonarjs/no-nested-conditional": "off",
            "sonarjs/no-nested-functions": "off",
            "sonarjs/pseudo-random": "off",
            "sonarjs/public-static-readonly": "off",
            "unicorn/consistent-function-scoping": "off",
            "unicorn/no-null": "off",
            "unicorn/no-useless-undefined": "off",
            "unicorn/prefer-module": "off",
        },
    },

    // Config files: Node globals, no React/TS-strict assumptions.
    {
        files: ["*.config.{ts,mjs,js}", "*.config.*.{ts,mjs,js}"],
        rules: {
            "import/no-anonymous-default-export": "off",
            "unicorn/no-anonymous-default-export": "off",
        },
    },

    // Service worker + build scripts: plain JS with no tsconfig coverage,
    // and the platform requires empty event handlers / process.cwd-style
    // file writes that the strict rules reject.
    {
        files: ["public/sw.js", "scripts/**/*.{js,mjs,cjs}"],
        rules: {
            "@typescript-eslint/no-empty-function": "off",
            "no-console": "off",
            "security/detect-non-literal-fs-filename": "off",
            "sonarjs/cognitive-complexity": "off",
            "unicorn/import-style": "off",
        },
    },

    // MUST be last: turns off any ESLint rules that conflict with
    // Prettier's formatting. Prettier itself runs as a separate command
    // (`npm run format` / `format:check`); we don't shell out to it
    // through ESLint because that pattern is no longer recommended.
    prettierConfig,

    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "coverage/**",
        "src/components/mockups/**",
        "src/app/mockups/**",
        "playwright-report/**",
        "test-results/**",
    ]),
]);

export default eslintConfig;
