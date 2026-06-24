import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The bundled Docker stack writes Postgres data + uploads here (root-owned);
    // it is runtime data, not source — skip it so `npm run lint` works after
    // `docker compose up`.
    "data/**",
  ]),
]);

export default eslintConfig;
