import { spawn } from "node:child_process"
import { rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"
const packageRunner = isWindows ? (process.env.ComSpec || "cmd.exe") : "corepack"
const authDir = path.join(root, ".visual-auth")
const headed = process.argv.includes("--headed")
const clearAuth = process.argv.includes("--clear-auth")
const productionAuthQa = process.argv.includes("--production-auth-qa")

function log(message) {
  process.stdout.write(`[visual:gate] ${message}\n`)
}

async function runLocalParity() {
  const runnerArgs = isWindows
    ? ["/d", "/s", "/c", "corepack", "pnpm@10.24.0", "exec", "playwright", "test", "--config=playwright.reference-4864782.config.ts"]
    : ["pnpm@10.24.0", "exec", "playwright", "test", "--config=playwright.reference-4864782.config.ts"]
  if (headed) runnerArgs.push("--headed")

  log("FASE A — local parity pre-deploy con fixture sintetiche e API localhost intercettate.")
  log("Non inserire credenziali production: questo gate non contatta backend remoti e non crea sessioni reali.")

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(packageRunner, runnerArgs, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        DOFLOW_VISUAL_LOCAL_PARITY: "1",
      },
    })
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0) {
    throw new Error(`local parity Playwright exited with ${exitCode}`)
  }
}

async function main() {
  if (clearAuth) {
    await rm(authDir, { recursive: true, force: true })
    log("Sessione visuale locale rimossa.")
    return
  }

  if (productionAuthQa) {
    process.stderr.write(
      "PRODUCTION AUTH MUST RUN ON PRODUCTION ORIGIN\n"
      + "Il QA autenticato è post-deploy e deve aprire direttamente https://app.doflow.it.\n"
      + "Questo comando pre-deploy non avvia browser, non legge credenziali e non modifica CORS/CSRF.\n",
    )
    process.exitCode = 2
    return
  }

  await runLocalParity()
  process.stdout.write("REFERENCE 4864782 LOCAL VISUAL PARITY GO\n")
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[visual:gate] ${message}\nREFERENCE 4864782 LOCAL VISUAL PARITY NO-GO\n`)
  process.exitCode = 1
}
