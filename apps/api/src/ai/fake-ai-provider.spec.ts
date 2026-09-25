import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkedItems } from '../vocabulary/extraction-rules.js';
import { AiProviderError } from './ai-provider.js';
import { FakeAiProvider } from './fake-ai-provider.js';

const photo = { data: Buffer.from('photo'), contentType: 'image/jpeg' };

describe('FakeAiProvider (B4)', () => {
  let provider: FakeAiProvider;

  beforeEach(() => {
    provider = new FakeAiProvider();
  });

  it('allows a photo and describes it', async () => {
    expect((await provider.checkPhoto(photo)).value).toEqual({ allowed: true });

    const { value: items } = await provider.extractVocabulary(photo);

    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0].english).toBe('sofa');
  });

  /* The fixed answer is only useful if it survives the rules the real one must pass. */
  it('returns items that all pass the extraction rules', async () => {
    const { value: items } = await provider.extractVocabulary(photo);

    expect(checkedItems(items)).toHaveLength(items.length);
  });

  /* What each call cost travels with the answer, so it can be recorded (AIR-007). */
  it('reports what a call cost', async () => {
    const { usage } = await provider.extractVocabulary(photo);

    expect(usage?.inputTokens).toBeGreaterThan(0);
    expect(usage?.outputTokens).toBeGreaterThan(0);
  });

  it('names itself and its model for the call record', () => {
    expect(provider.name).toBe('fake');
    expect(provider.modelFor('EXTRACTION')).toBe('fake-extraction');
  });

  it('blocks a photo with a category when asked', async () => {
    provider.behaviour = 'BLOCKED';

    expect((await provider.checkPhoto(photo)).value).toEqual({
      allowed: false,
      category: 'VIOLENCE',
    });
  });

  it.each([
    ['PROVIDER_ERROR', 'PROVIDER_ERROR'],
    ['TIMED_OUT', 'TIMED_OUT'],
  ] as const)('fails as %s when asked', async (behaviour, code) => {
    provider.behaviour = behaviour;

    await expect(provider.checkPhoto(photo)).rejects.toMatchObject({ code });
    await expect(provider.extractVocabulary(photo)).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it('returns too few words when asked (FR-024)', async () => {
    provider.behaviour = 'TOO_FEW_WORDS';

    expect((await provider.extractVocabulary(photo)).value).toHaveLength(2);
  });

  /* What a bad response looks like: every item is refused, so nothing can be saved. */
  it('returns output that fails every rule when asked', async () => {
    provider.behaviour = 'INVALID_OUTPUT';

    const { value: items } = await provider.extractVocabulary(photo);

    expect(items.length).toBeGreaterThan(0);
    expect(checkedItems(items)).toEqual([]);
  });

  describe('behaveOnce', () => {
    it('affects the next call only', async () => {
      provider.behaveOnce('BLOCKED');

      expect((await provider.checkPhoto(photo)).value).toEqual({
        allowed: false,
        category: 'VIOLENCE',
      });
      // The standing behaviour is back, which is how a test fails one call of two.
      expect((await provider.checkPhoto(photo)).value).toEqual({
        allowed: true,
      });
    });

    it('lets the check pass and the extraction fail', async () => {
      expect((await provider.checkPhoto(photo)).value).toEqual({
        allowed: true,
      });
      provider.behaveOnce('PROVIDER_ERROR');

      await expect(provider.extractVocabulary(photo)).rejects.toBeInstanceOf(
        AiProviderError,
      );
    });
  });

  it('remembers what it was asked, in order', async () => {
    await provider.checkPhoto(photo);
    await provider.extractVocabulary(photo);

    expect(provider.calls.map((call) => call.purpose)).toEqual([
      'SAFETY_CHECK',
      'EXTRACTION',
    ]);
  });
});

/* Development-only: the real analysis takes about 20 seconds, the fake none at all. */
describe('the delay a developer can ask for', () => {
  it('answers at once by default', async () => {
    const provider = new FakeAiProvider();

    await expect(provider.checkPhoto(photo)).resolves.toMatchObject({
      value: { allowed: true },
    });
  });

  it('waits that long before answering, and before failing', async () => {
    vi.useFakeTimers();
    try {
      const provider = new FakeAiProvider();
      provider.delayMs = 5_000;

      const answer = provider.extractVocabulary(photo);
      let settled = false;
      void answer.then(() => (settled = true));
      await vi.advanceTimersByTimeAsync(4_000);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(settled).toBe(true);

      provider.behaviour = 'PROVIDER_ERROR';
      const failing = provider.checkPhoto(photo);
      const caught = expect(failing).rejects.toBeInstanceOf(AiProviderError);
      await vi.advanceTimersByTimeAsync(5_000);
      await caught;
    } finally {
      vi.useRealTimers();
    }
  });
});
