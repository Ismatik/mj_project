import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // `import "server-only"` throws unless the importer is a React Server Component, which would put
  // every src/server/* module out of reach of a unit test. A test has no client bundle to protect.
  resolve: { alias: { "server-only": path.resolve(__dirname, "test/server-only.stub.ts") } },
  test: { include: ["src/**/*.test.ts", "worker/**/*.test.ts"], environment: "node" },
});
