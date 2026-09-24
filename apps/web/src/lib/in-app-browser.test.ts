import { describe, expect, it } from 'vitest';
import {
  externalBrowserUrl,
  inAppBrowserFrom,
  providersFor,
} from './in-app-browser';

const LINE_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.5.0 NetType/WIFI';
const LINE_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Line/14.5.2/IAB';
const FACEBOOK_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBID/phone;FBLC/th_TH]';
const FACEBOOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S921B Build/UP1A) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/466.0.0.36.109;]';
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('recognising an in-app browser (NFR-018)', () => {
  it.each([
    ['LINE on iOS', LINE_IOS, 'line'],
    ['LINE on Android', LINE_ANDROID, 'line'],
    ['Facebook on iOS', FACEBOOK_IOS, 'facebook'],
    ['Facebook on Android', FACEBOOK_ANDROID, 'facebook'],
  ])('recognises %s', (_name, userAgent, expected) => {
    expect(inAppBrowserFrom(userAgent)).toBe(expected);
  });

  it('treats an ordinary browser as ordinary', () => {
    expect(inAppBrowserFrom(SAFARI)).toBeNull();
    expect(inAppBrowserFrom(null)).toBeNull();
    // "Line" inside another word is not LINE's own browser.
    expect(inAppBrowserFrom('Mozilla/5.0 Streamline/2.1')).toBeNull();
  });
});

describe('which providers to offer (US-006)', () => {
  it('offers everything in an ordinary browser', () => {
    expect(providersFor(['google', 'line'], null)).toEqual(['google', 'line']);
  });

  /* Google answers `disallowed_useragent` inside these, so the button is a dead end. */
  it.each(['line', 'facebook'] as const)(
    'hides Google inside %s',
    (browser) => {
      expect(providersFor(['google', 'line'], browser)).toEqual(['line']);
    },
  );

  it('can end up offering none, leaving email sign-in', () => {
    expect(providersFor(['google'], 'facebook')).toEqual([]);
  });
});

describe('opening the device browser', () => {
  it('asks LINE to hand the address over', () => {
    expect(externalBrowserUrl('https://languze.com/sign-in')).toBe(
      'https://languze.com/sign-in?openExternalBrowser=1',
    );
  });

  it('keeps the rest of the address', () => {
    expect(externalBrowserUrl('https://languze.com/sign-in?error=x')).toBe(
      'https://languze.com/sign-in?error=x&openExternalBrowser=1',
    );
  });
});
