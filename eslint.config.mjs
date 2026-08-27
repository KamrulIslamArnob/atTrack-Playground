import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Experimental React Compiler lint rules (set-state-in-effect, purity, preserve-manual-memoization)
      // fire on data-loading or manual memoization patterns. The patterns are intentional
      // and work; these rules are noisy here, so they're switched off at config level.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Server code logs through lib/log (pino), never console: a console call
    // bypasses redaction, the NDJSON format and the log file the drain ships,
    // so it is invisible to every consumer of the logs. Client components and
    // scripts/ are exempt — they have no logger and no drain.
    files: ["lib/**/*.ts", "app/api/**/*.ts"],
    ignores: ["lib/log/**", "lib/ai-chatbot/use-chat.ts", "lib/ai-chatbot/sessions.ts"],
    rules: {
      "no-console": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "release/**",
    "electron/**",
    "scripts/**",
    ".data/**",
    // Static assets, not source. scripts/copy-pdf-worker.js drops a ~1 MB minified
    // pdf.js worker in here on install; linting it is meaningless noise.
    "public/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
