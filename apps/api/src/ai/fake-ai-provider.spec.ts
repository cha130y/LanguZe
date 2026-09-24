import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(await provider.checkPhoto(photo)).toEqual({ allowed: true });

    const items = await provider.extractVocabulary(photo);

    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0].english).toBe('sofa');
  });

  /* The fixed answer is only useful if it survives the rules the real one must pass. */
  it('returns items that all pass the extraction rules', async () => {
    const items = await provider.extractVocabulary(photo);

    expect(checkedItems(items)).toHaveLength(items.length);
  });

  it('blocks a photo with a category when asked', async () => {
    provider.behaviour = 'BLOCKED';

    expect(await provider.checkPhoto(photo)).toEqual({
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

    expect(await provider.extractVocabulary(photo)).toHaveLength(2);
  });

  /* What a bad response looks like: every item is refused, so nothing can be saved. */
  it('returns output that fails every rule when asked', async () => {
    provider.behaviour = 'INVALID_OUTPUT';

    const items = await provider.extractVocabulary(photo);

    expect(items.length).toBeGreaterThan(0);
    expect(checkedItems(items)).toEqual([]);
  });

  describe('behaveOnce', () => {
    it('affects the next call only', async () => {
      provider.behaveOnce('BLOCKED');

      expect(await provider.checkPhoto(photo)).toEqual({
        allowed: false,
        category: 'VIOLENCE',
      });
      // The standing behaviour is back, which is how a test fails one call of two.
      expect(await provider.checkPhoto(photo)).toEqual({ allowed: true });
    });

    it('lets the check pass and the extraction fail', async () => {
      expect(await provider.checkPhoto(photo)).toEqual({ allowed: true });
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
