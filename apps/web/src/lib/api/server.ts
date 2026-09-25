import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  isProvider,
  type Account,
  type Provider,
  type Usage,
  type World,
  type WorldSummary,
} from './client';

/**
 * Reads on the server, with the learner's session cookie. `null` means the API
 * refused or could not be reached, which every page renders as its empty state
 * rather than as a crash.
 */
async function read<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Cookie: cookieHeader },
      // Worlds and their signed photo links change and expire, so nothing is cached.
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** The learner's worlds, newest first (FR-013). */
export const getWorlds = () => read<WorldSummary[]>('/v1/worlds');

/** One world, or null when it does not exist or belongs to someone else (FR-008). */
export const getWorld = (worldId: string) =>
  read<World>(`/v1/worlds/${worldId}`);

/**
 * What is left of today's analyses (FR-080, US-080). `null` means the API could not
 * say, and every page treats that as "unknown" rather than as "none left": refusing
 * an upload because a count could not be read would be worse than letting the API
 * refuse it itself.
 */
export const getUsage = () => read<Usage>('/v1/me/usage');

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
