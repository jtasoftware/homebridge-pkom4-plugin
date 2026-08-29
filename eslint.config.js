import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**"],
  },
  {
    rules: {
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": ["error"],
      "dot-notation": ["error"],
      "no-multi-spaces": ["warn", { "ignoreEOLComments": true }],
      "linebreak-style": ["error", "unix"],
      "lines-between-class-members": ["warn", "always", { "exceptAfterSingleLine": true }],
      "brace-style": ["warn"],
      "prefer-arrow-callback": ["warn"],
      "object-curly-spacing": ["error", "always"],
      "@typescript-eslint/no-use-before-define": ["error", { "classes": false, "enums": false }],
      "@typescript-eslint/no-unused-vars": ["error", { "caughtErrors": "none" }],
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
