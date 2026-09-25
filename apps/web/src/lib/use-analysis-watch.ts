'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from './api/client';

/** How often the web app asks whether an analysis has finished (P3). */
export const POLL_MS = 3_000;

/**
 * When to stop asking. The API fails an analysis that has not finished five minutes
 * after it started (V16) and looks for those every minute, so after six minutes the
 * world has either changed or something is wrong that more asking cannot mend.
 */
export const GIVE_UP_MS = 6 * 60_000;

/**
 * Watches worlds that are still being analysed and refreshes the page when one of
 * them finishes (FR-021, P3). Asking stops when the learner leaves the page and
 * after `GIVE_UP_MS`; nothing is asked at all when no world is being analysed.
 *
 * The status endpoint is used rather than refreshing the whole page on a timer,
 * because a refresh signs new photo links every time, which would make the picture
 * flicker while the learner waits.
 *
 * Returns whether it gave up, which a page shows as "refresh to see the result"
 * instead of a spinner that would turn for ever.
 */
export function useAnalysisWatch(worldIds: readonly string[]): {
  gaveUp: boolean;
} {
  const router = useRouter();
  // One string, so a new array of the same ids on every render is not a new effect.
  const key = worldIds.join(' ');
  /*
   * Which set of worlds was given up on, rather than a flag: a different set is a
   * new wait, and remembering the key is what resets it without the effect having
   * to set state as it starts.
   */
  const [gaveUpOn, setGaveUpOn] = useState<string | null>(null);

  useEffect(() => {
    const ids = key ? key.split(' ') : [];
    if (ids.length === 0) return;

    const startedAt = Date.now();
    let asking = false;

    const ask = async () => {
      // A slow answer must not have more requests piling up behind it.
      if (asking) return;
      asking = true;
      try {
        if (Date.now() - startedAt >= GIVE_UP_MS) {
          clearInterval(timer);
          setGaveUpOn(key);
          return;
        }
        const statuses = await Promise.all(
          ids.map((id) =>
            api
              .worldStatus(id)
              .then(({ status }) => status)
              // An unreachable API is not an answer, so keep waiting for one.
              .catch(() => 'ANALYZING'),
          ),
        );
        /*
         * The interval is left running: if the refreshed page still shows the world
         * as being analysed, the next turn asks again rather than leaving a spinner
         * that nothing will ever stop.
         */
        if (statuses.some((status) => status !== 'ANALYZING')) router.refresh();
      } finally {
        asking = false;
      }
    };

    const timer = setInterval(() => void ask(), POLL_MS);
    return () => clearInterval(timer);
  }, [key, router]);

  return { gaveUp: gaveUpOn === key };
}
