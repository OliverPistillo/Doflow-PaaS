import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stack = path.join(root, "scripts", "commercial-core-isolated-stack.mjs");

function run(command, args, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status ?? "unknown"}.`);
  }
  return result.status ?? 1;
}

function pnpm(args) {
  if (process.platform === "win32") {
    return run(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `pnpm ${args.join(" ")}`],
      true,
    );
  }
  return run("pnpm", args, true);
}

let exitCode = 1;
let failure;
try {
  run(process.execPath, [stack, "up"]);
  exitCode = pnpm([
    "exec",
    "playwright",
    "test",
    "--config=playwright.universal-features.config.ts",
  ]);
} catch (error) {
  failure = error;
} finally {
  try {
    run(process.execPath, [stack, "down"]);
  } catch (error) {
    failure ??= error;
    exitCode = 1;
  }
}

if (failure) {
  process.stderr.write(
    `[acceptance:universal] ${failure instanceof Error ? failure.message : "gate failed"}\n`,
  );
}
process.exitCode = exitCode;
