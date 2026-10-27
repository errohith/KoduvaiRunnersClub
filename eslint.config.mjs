import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Destructuring to omit fields (e.g. stripping IPs from API responses) is intentional.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"] },
];
