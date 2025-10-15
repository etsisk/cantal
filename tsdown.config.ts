import { defineConfig } from "tsdown";

export default defineConfig({
  copy: ["src/cantal.css", { from: "src/cantal.css", to: "dist/cantal.css" }],
  entry: ["./src/index.ts"],
  minify: true,
});
