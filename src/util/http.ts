export interface FetchedResponse {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  /** raw `set-cookie` lines, preserved individually. */
  setCookie: string[];
  body: string;
  redirected: boolean;
}

/**
 * Fetch a URL following redirects, returning normalized (lowercased-key)
 * headers plus the raw set-cookie array (which fetch otherwise folds).
 */
export async function fetchUrl(
  url: string,
  opts: { timeoutMs?: number; method?: string; headers?: Record<string, string> } = {},
): Promise<FetchedResponse> {
  const { timeoutMs = 30_000, method = "GET", headers = {} } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "user-agent": "lgtm/0.1 (+security-harness)", ...headers },
      signal: ctrl.signal,
    });
    const norm: Record<string, string> = {};
    res.headers.forEach((v, k) => (norm[k.toLowerCase()] = v));
    // Node's undici exposes getSetCookie(); fall back gracefully.
    const setCookie =
      typeof (res.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie === "function"
        ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : norm["set-cookie"]
          ? [norm["set-cookie"]]
          : [];
    const body = await res.text();
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      headers: norm,
      setCookie,
      body,
      redirected: res.redirected,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0";
  } catch {
    return false;
  }
}
