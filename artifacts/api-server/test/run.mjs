import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "slipless-tests-"));
try {
  const entry = process.argv.includes("--api") ? "api" : "schedule";
  await build({
    entryPoints: [`test/${entry}.test.ts`],
    outfile: join(dir, `${entry}.test.mjs`),
    bundle: true,
    platform: "node",
    format: "esm",
  });
  const result = spawnSync(
    process.execPath,
    ["--test", join(dir, `${entry}.test.mjs`)],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
