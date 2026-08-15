import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Experimental React Compiler lint rules (set-state-in-effect, purity)
      // fire on the standard fetch-then-setState data-loading pattern used
      // throughout the admin screens. The pattern is intentional and works;
      // these rules are noisy here, so they're switched off at the config
      // level rather than sprinkled with per-line disables.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
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
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
