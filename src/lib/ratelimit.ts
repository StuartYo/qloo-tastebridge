// Guards for the public demo so judging traffic can't burn the Qloo key's quota (5 req/s, 10,000/month):
// a per-visitor daily cap, a per-visitor burst cap, and a small in-memory cache of finished answers.
const hits = new Map<string, { day: string; n: number; recent: number[] }>();
const LIMIT = Number(process.env.DEMO_DAILY_LIMIT ?? 30);
const BURST = Number(process.env.DEMO_BURST_PER_MINUTE ?? 6);

export const clientKey = (req: Request) => (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "local").split(",")[0].trim();

export function allow(req: Request, bucket = "ai", limit = LIMIT, burst = BURST) {
  const key = bucket + ":" + clientKey(req);
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  let h = hits.get(key);
  if (!h || h.day !== day) { h = { day, n: 0, recent: [] }; hits.set(key, h); }
  h.recent = h.recent.filter(t => now - t < 60_000);
  if (h.n >= limit || h.recent.length >= burst) return false;
  h.n++; h.recent.push(now);
  if (hits.size > 5000) hits.clear();
  return true;
}

// Finished answers for identical inputs (cheap repeat clicks on the demo buttons cost no Qloo calls).
const answers = new Map<string, { at: number; value: unknown }>();
const ANSWER_TTL_MS = 6 * 3600 * 1000;
export function cachedAnswer<T>(key: string): T | undefined {
  const a = answers.get(key);
  if (!a || Date.now() - a.at > ANSWER_TTL_MS) return undefined;
  return a.value as T;
}
export function storeAnswer(key: string, value: unknown) {
  if (answers.size >= 200) answers.delete(answers.keys().next().value!);
  answers.set(key, { at: Date.now(), value });
}

/** Personal data must not go to Qloo (event rule): drop e-mails, phone numbers and URLs from free text. */
export function stripPersonalData(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\+?\d[\d\s-]{7,}\d/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
