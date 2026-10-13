// Dev-only: on Windows, a user-level env var set after the terminal opened is not inherited by child
// processes. Read the key from HKCU\Environment instead. Never logs or returns the key anywhere except
// to the caller; production (and non-Windows) relies on the normal environment only.
import { execFileSync } from "child_process";

const cached = new Map<string, string | null>();

export function devEnvKey(name: "QLOO_API_KEY" | "ANTHROPIC_API_KEY", env: Record<string, string | undefined> = process.env): string | undefined {
  if (env[name]) return env[name];
  if (process.platform !== "win32" || env.NODE_ENV === "production" || env.VERCEL) return undefined;
  if (!cached.has(name)) {
    let v: string | null = null;
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Environment", "/v", name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      v = out.match(new RegExp(`${name}\\s+REG_\\w+\\s+(\\S+)`))?.[1] ?? null;
    } catch { v = null; }
    cached.set(name, v);
  }
  return cached.get(name) ?? undefined;
}

export const devQlooKey = (env: Record<string, string | undefined> = process.env) => devEnvKey("QLOO_API_KEY", env);
export const devAnthropicKey = (env: Record<string, string | undefined> = process.env) => devEnvKey("ANTHROPIC_API_KEY", env);
