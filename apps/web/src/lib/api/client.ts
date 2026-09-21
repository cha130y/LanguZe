import type { paths } from './schema';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

type Json<T> = T extends { content: { 'application/json': infer B } }
  ? B
  : never;

export type Account = Json<paths['/v1/me']['get']['responses'][200]>;
export type SignUpBody = Json<paths['/v1/auth/sign-up']['post']['requestBody']>;
export type SignInBody = Json<paths['/v1/auth/sign-in']['post']['requestBody']>;
export type AcceptTermsBody = Json<
  paths['/v1/me/terms']['post']['requestBody']
>;

/** The providers LanguZe offers (FR-003). */
export type Provider = 'google';

/** The error shape every endpoint uses (API design, section 2.4). */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiErrorBody).error?.code === 'string'
  );
}

/**
 * Calls the API with the session cookie. The browser adds the `Origin` header,
 * which the API requires for requests that change data (API design, section 2.3).
 */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    // No answer at all: the API is unreachable, or the network dropped.
    throw new ApiError('NETWORK_ERROR', 0, 'The API could not be reached.');
  }

  const body: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(
        body.error.code,
        response.status,
        body.error.message,
        body.error.details,
      );
    }
    throw new ApiError(
      'INTERNAL_ERROR',
      response.status,
      'The request failed.',
    );
  }

  return body as T;
}

export const api = {
  signUp: (body: SignUpBody) =>
    call<Account>('/v1/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  signIn: (body: SignInBody) =>
    call<Account>('/v1/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  signOut: () => call<void>('/v1/auth/sign-out', { method: 'POST' }),
  sendVerificationEmail: (email: string) =>
    call<{ ok: true }>('/v1/auth/send-verification-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyEmail: (token: string) =>
    call<{ ok: true }>('/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  requestPasswordReset: (email: string) =>
    call<{ ok: true }>('/v1/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    call<{ ok: true }>('/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  me: () => call<Account>('/v1/me'),
  acceptTerms: (body: AcceptTermsBody) =>
    call<Account>('/v1/me/terms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  declineTerms: () => call<void>('/v1/me/terms/decline', { method: 'POST' }),

  /**
   * Starts sign-in with a provider (FR-003). Better Auth serves this itself at
   * `/auth`, outside the `/v1` endpoints, so it answers with its own shape rather
   * than LanguZe's error contract and is called directly rather than through `call`.
   *
   * A first-time sign-up is sent to the Terms step and an existing account straight
   * home, which is `newUserCallbackURL` doing the work — the web app never has to
   * ask which case it is.
   */
  async startProviderSignIn(provider: Provider): Promise<string> {
    const origin = window.location.origin;
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/sign-in/social`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          callbackURL: `${origin}/`,
          newUserCallbackURL: `${origin}/terms`,
          errorCallbackURL: `${origin}/sign-in?error=provider`,
        }),
      });
    } catch {
      throw new ApiError('NETWORK_ERROR', 0, 'The API could not be reached.');
    }

    const body: unknown = await response.json().catch(() => undefined);
    const url =
      typeof body === 'object' && body !== null && 'url' in body
        ? (body as { url: unknown }).url
        : undefined;

    if (!response.ok || typeof url !== 'string') {
      throw new ApiError(
        'SERVICE_UNAVAILABLE',
        response.status,
        'Provider sign-in could not be started.',
      );
    }
    return url;
  },
};
