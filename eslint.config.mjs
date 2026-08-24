import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react/no-unescaped-entities": "off",
      "prefer-const": "warn",
      "@next/next/no-img-element": "warn"
    }
  },
  {
    files: ["**/live-preview-frame.tsx"],
    rules: {
      "@next/next/no-img-element": "off" // Dynamic WebSocket stream images require regular img tag
    }
  }
];

export default eslintConfig;
