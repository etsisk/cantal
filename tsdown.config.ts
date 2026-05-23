import { defineConfig } from "tsdown";

export default defineConfig({
  css: {
    fileName: "cantal.css",
    minify: true,
  },
  entry: ["./src/index.ts"],
  minify: true,
  target: false,
});
