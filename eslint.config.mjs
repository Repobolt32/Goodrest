import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["check_db.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".gemini/**",
    ".agent/**",
    ".agent_backup/**",
    "claude-kit/**",
    ".opencode/**",
    "playwright-report/**",
    "test-results/**",
    "check_db.js",
    "check_db_orders.js",
    "scripts/**",
    "electron/**",
    ".chrome-profile/**",
    ".chrome-profile-headful/**",
    "release/**",
    "*.js",
    "*.cjs",
  ]),
]);

export default eslintConfig;