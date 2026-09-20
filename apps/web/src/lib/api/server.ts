import { cookies } from 'next/headers';
import { API_BASE_URL, type Account } from './client';

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
