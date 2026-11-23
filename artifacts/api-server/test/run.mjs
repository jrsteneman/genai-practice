import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "slipless-tests-"));
try {
  const entry = process.argv.includes("--budget") ? "budget"
    : process.argv.includes("--api") ? "api" : "schedule";
  await build({
    entryPoints: [`test/${entry}.test.ts`],
    outfile: join(dir, `${entry}.test.mjs`),
    bundle: true,
    platform: "node",
    format: "esm",
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  });
  const result = spawnSync(
    process.execPath,
    ["--test", join(dir, `${entry}.test.mjs`)],
    { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
