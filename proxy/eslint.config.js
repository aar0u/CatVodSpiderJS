import pluginTypescript from "@typescript-eslint/eslint-plugin";
import parserTypescript from "@typescript-eslint/parser";
import pluginImport from "eslint-plugin-import";
import pluginPrettier from "eslint-plugin-prettier";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    languageOptions: {
      parser: parserTypescript, // 使用 TypeScript 解析器
    },
    plugins: {
      "import": pluginImport,
      "@typescript-eslint": pluginTypescript,
      "prettier": pluginPrettier,
    },
    rules: {
      ...pluginTypescript.configs.recommended.rules,
      ...pluginTypescript.configs.strict.rules,
      "prettier/prettier": "error",
      "comma-dangle": "off",
      "max-len": "off",
      "indent": "off",
      "quotes": "off", // this and above taken care by prettier
      "import/order": [
        "error",
        {
          "groups": [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          "alphabetize": {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
];
