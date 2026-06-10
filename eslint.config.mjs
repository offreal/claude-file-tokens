import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["out/**", "node_modules/**", "assets/**", "*.vsix"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: { "@stylistic": stylistic },
    rules: {
      // Reading external, untyped JSON (~/.claude.json) is a legitimate `any`
      // boundary; we validate shape at runtime instead of through types.
      "@typescript-eslint/no-explicit-any": "off",
      // Breathing room between logical blocks: a blank line after a run of
      // variable declarations and around if / try / for / while / switch.
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        {
          blankLine: "always",
          prev: "*",
          next: ["if", "try", "for", "while", "switch"],
        },
        {
          blankLine: "always",
          prev: ["if", "try", "for", "while", "switch"],
          next: "*",
        },
      ],
    },
  },
  {
    // CommonJS build script run by Node, not bundled into the extension.
    files: ["esbuild.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Turns off rules that would fight Prettier.
  prettier,
  {
    // After eslint-config-prettier (which disables curly): re-enable the
    // early-return style — no braces around a single-statement body
    // (`if (!model) continue;`), braces kept when the body has 2+ statements.
    // Brace-less single-line guards format cleanly under Prettier.
    files: ["src/**/*.ts"],
    rules: {
      curly: ["error", "multi"],
    },
  }
);
