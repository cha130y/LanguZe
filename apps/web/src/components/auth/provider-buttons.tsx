'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, type Provider } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';

const LABEL: Record<Provider, string> = {
  google: 'Google',
};

/**
 * Starts sign-in with a provider (US-004). The API answers with the provider's
 * address and the browser goes there, so this never renders a result of its own —
 * the learner comes back to the Terms step or to the home page.
 */
export function ProviderButtons({ providers }: { providers: Provider[] }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    try {
      const url = await api.startProviderSignIn(provider);
      // `assign` rather than setting `location.href`, which the compiler treats as
      // mutating a tracked value.
      window.location.assign(url);
    } catch (caught) {
      setError(messageForError(caught));
      setBusy(null);
    }
  };

  if (providers.length === 0) return null;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">หรือ</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          size="xl"
          className="w-full"
          onClick={() => void start(provider)}
          disabled={busy !== null}
        >
          {busy === provider
            ? 'กำลังเชื่อมต่อ…'
            : `ดำเนินการต่อด้วย ${LABEL[provider]}`}
        </Button>
      ))}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
