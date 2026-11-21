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

// Auth scheme is not decided with the backend yet. Whoever owns login plugs the token in here,
// so this module never decides where tokens are stored.
let authTokenProvider: () => string | null = () => null;
export function setAuthTokenProvider(provider: () => string | null) {
  authTokenProvider = provider;
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
}

export async function http<T>(path: string, { json, headers, ...init }: HttpOptions = {}): Promise<T> {
  const token = authTokenProvider();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

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
    throw new ApiError(res.status, extractMessage(body) ?? `요청에 실패했습니다. (HTTP ${res.status})`, body);
  }
  return body as T;
}
