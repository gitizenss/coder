/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@local/eslint-config/block.cjs"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["tsconfig.json"],
  },
};
