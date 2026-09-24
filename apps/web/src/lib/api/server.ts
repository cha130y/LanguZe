import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  isProvider,
  type Account,
  type Provider,
} from './client';

/**
 * The provider sign-ins the API offers (FR-003). Asking the API keeps the two in
 * step: a provider whose credentials are missing is never shown as a button that
 * cannot work. The answer changes only when the API is reconfigured, so it is
 * cached briefly; if the API cannot be reached, the page shows email sign-in alone.
 */
export async function getProviders(): Promise<Provider[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/providers`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { providers?: unknown };
    return Array.isArray(body.providers)
      ? body.providers.filter(
          (provider): provider is Provider =>
            typeof provider === 'string' && isProvider(provider),
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Reads the signed-in account on the server, forwarding the session cookie the
 * browser sent (architecture overview, section 4). Returns null when nobody is signed in.
 */
export async function getAccount(): Promise<Account | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/v1/me`, {
      headers: { Cookie: cookieHeader },
      // The account can change at any time, so this is never cached.
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as Account;
  } catch {
    // The API being unreachable must not break the page; it renders as signed out.
    return null;
  }
}
