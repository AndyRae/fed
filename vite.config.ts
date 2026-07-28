import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Relative, not absolute — same trick PGSimCity uses (see its
  // vite.config.ts) so the same build works unchanged whether it's served
  // from a GitHub Pages project subpath (/fed/) or a file share from a
  // local disk, per CLAUDE.md "Stack": "must deploy as static files
  // (GitHub Pages) and run inside an NHS network from a file share if it
  // has to."
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
