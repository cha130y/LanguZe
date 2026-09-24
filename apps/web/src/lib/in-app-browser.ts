import type { Provider } from './api/client';

/** The in-app browsers LanguZe has to work in (NFR-018). */
export type InAppBrowser = 'line' | 'facebook';

/*
 * LINE appends `Line/<version>` to the user agent, and the Facebook apps append
 * `FBAN`, `FBAV` or `FB_IAB`. Both are matched loosely on purpose: the version and
 * the surrounding text change, and a wrong guess only changes which buttons are
 * offered, never whether sign-in works.
 */
const LINE = /(?:^|[\s;(])Line\/\d/i;
const FACEBOOK = /\bFB(?:AN|AV|_IAB)\b/;

/** Which in-app browser a request came from, if any. */
export function inAppBrowserFrom(
  userAgent: string | null,
): InAppBrowser | null {
  if (!userAgent) return null;
  if (LINE.test(userAgent)) return 'line';
  if (FACEBOOK.test(userAgent)) return 'facebook';
  return null;
}

/**
 * The providers worth offering where the page is open (US-006, NFR-018).
 *
 * Google refuses OAuth inside an embedded browser — it answers `disallowed_useragent`
 * — so offering it there is a dead end. The learner is shown the methods that do work,
 * plus a way to open LanguZe in the device's own browser, where Google works again.
 */
export function providersFor(
  providers: readonly Provider[],
  inAppBrowser: InAppBrowser | null,
): Provider[] {
  if (!inAppBrowser) return [...providers];
  return providers.filter((provider) => provider !== 'google');
}

/**
 * LINE opens a link in the device's browser when the address carries
 * `openExternalBrowser=1`, which is LINE's own documented escape hatch. The
 * Facebook apps have no equivalent, so there the learner is told where to find
 * "Open in browser" in the app's own menu instead.
 */
export function externalBrowserUrl(url: string): string {
  const address = new URL(url);
  address.searchParams.set('openExternalBrowser', '1');
  return address.toString();
}
