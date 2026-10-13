import type { Params } from "./types";

export function toQuery(params: Params): string {
  return Object.keys(params).sort()
    .filter(k => params[k] !== undefined && params[k] !== "" && !(Array.isArray(params[k]) && !(params[k] as string[]).length))
    .map(k => { const v = params[k]; return `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : String(v))}`; })
    .join("&");
}
