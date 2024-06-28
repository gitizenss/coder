import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

const production = !process.env.ROLLUP_WATCH;

const outDir = (fmt) => `dist/${fmt}`;

const rolls = (fmt, input, outFileName) => ({
  input,
  output: {
    file: `${outDir(fmt)}/${outFileName}.${fmt === "cjs" ? "cjs" : "js"}`,
    format: fmt,
    entryFileNames: `[name].${fmt === "cjs" ? "cjs" : "js"}`,
    name: "graph",
    sourcemap: !production,
  },
  plugins: [
    typescript({
      declaration: true,
      declarationDir: outDir(fmt),
      outDir: outDir(fmt),
      rootDir: "src",
      sourceMap: !production,
      inlineSources: !production,
      outputToFilesystem: false,
    }),
    json(),
    commonjs(),
  ],
});
export default ["es", "cjs"].flatMap((fmt) =>
  [
    "main",
    "stdlib",
    "custom-element",
    "react",
    "graph-module-json",
    "internal",
    "codegen",
  ].map((input) => rolls(fmt, `src/${input}.ts`, `${input}`)),
);
