import { headers } from 'next/headers';
import { OpenInBrowserNotice } from '@/components/auth/open-in-browser-notice';
import { ProviderButtons } from '@/components/auth/provider-buttons';
import { getProviders } from '@/lib/api/server';
import { inAppBrowserFrom, providersFor } from '@/lib/in-app-browser';

/**
 * The provider sign-ins on the sign-in and sign-up pages (FR-003, US-006).
 *
 * Which providers exist comes from the API, and which of them are worth showing
 * depends on where the page is open: inside the LINE and Facebook browsers Google
 * refuses its own sign-in, so it is replaced by a way out to the device's browser.
 */
export async function ProviderSection() {
  const [configured, headerList] = await Promise.all([
    getProviders(),
    headers(),
  ]);
  const inAppBrowser = inAppBrowserFrom(headerList.get('user-agent'));
  const providers = providersFor(configured, inAppBrowser);
  // The notice explains Google's absence, so it belongs only where Google was dropped.
  const googleHidden = inAppBrowser !== null && configured.includes('google');

  if (providers.length === 0 && !googleHidden) return null;

  return (
    <div className="mt-5">
      <ProviderButtons providers={providers} />
      {googleHidden && inAppBrowser ? (
        <OpenInBrowserNotice browser={inAppBrowser} />
      ) : null}
    </div>
  );
}
