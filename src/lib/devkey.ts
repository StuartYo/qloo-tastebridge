// Dev-only: on Windows, a user-level env var set after the terminal opened is not inherited by child
// processes. Read QLOO_API_KEY from HKCU\Environment instead. Never logs or returns the key anywhere
// except to the caller; production (and non-Windows) relies on the normal environment only.
import { execFileSync } from "child_process";

let cached: string | null | undefined;

export function devQlooKey(env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.QLOO_API_KEY) return env.QLOO_API_KEY;
  if (process.platform !== "win32" || env.NODE_ENV === "production" || env.VERCEL) return undefined;
  if (cached === undefined) {
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "QLOO_API_KEY"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      cached = out.match(/QLOO_API_KEY\s+REG_\w+\s+(\S+)/)?.[1] ?? null;
    } catch { cached = null; }
  }
  return cached ?? undefined;
}
