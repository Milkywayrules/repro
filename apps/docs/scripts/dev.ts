import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "@repro/env/docs";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));

const child = spawn(
  "bun",
  ["--bun", "next", "dev", "--hostname=0.0.0.0", "-p", String(env.PORT)],
  {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, PORT: String(env.PORT) },
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
