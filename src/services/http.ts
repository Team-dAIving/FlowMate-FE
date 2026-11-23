const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/** True when a backend URL is configured. Otherwise the app keeps using local mock data. */
export const USE_REAL_API = BASE_URL.length > 0;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth: the JWT goes out as "Authorization: Bearer <token>".
// - Desktop: attached by the Electron main process (electron/auth.cjs); this code never sees the token.
// - Web: there is no main process, so the web session (services/webAuth.ts) provides it here.
let webTokenProvider: () => string | null = () => null;
export function setWebTokenProvider(provider: () => string | null) {
  webTokenProvider = provider;
}
const isDesktop = () => Boolean(window.electronAPI?.isElectron);

// Called when the server rejects the session (401), so the app can drop it and show the login screen.
let unauthorizedHandler: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

function extractMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.message === 'string' && b.message) return b.message;
    if (typeof b.error === 'string' && b.error) return b.error;
  }
  return undefined;
}

interface HttpOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  /** Defaults to 15s. Slow server work (AI generation, GitHub import) passes a longer one. */
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 15000;

export async function http<T>(
  path: string,
  { json, headers, signal, timeoutMs = REQUEST_TIMEOUT_MS, ...init }: HttpOptions = {}
): Promise<T> {
  const webToken = isDesktop() ? null : webTokenProvider();
  // A server that accepts the connection but never answers would otherwise hang the app forever
  const timeout = AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
        ...(webToken ? { Authorization: `Bearer ${webToken}` } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch (err) {
    // Network down, CORS refused, DNS, timeout: one clear message instead of "TypeError: Failed to fetch"
    if (signal?.aborted) throw err; // the caller cancelled on purpose
    const timedOut = timeout.aborted;
    throw new ApiError(
      0,
      timedOut ? '서버 응답이 너무 늦습니다. 잠시 후 다시 시도해주세요.' : '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.',
      err
    );
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler();
    throw new ApiError(res.status, extractMessage(body) ?? `요청에 실패했습니다. (HTTP ${res.status})`, body);
  }
  return body as T;
}
