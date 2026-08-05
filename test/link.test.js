const assert = require('assert');
const { route } = require('../public/assets/js/link.js');

const playBadgeHref = 'https://play.google.com/store/apps/details?id=com.kidd.connect_merge';
const chromeAndroid = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36';
const code = 'ABCD2345';
let passed = 0;

function test(name, run) {
  run();
  passed += 1;
  console.log('ok - ' + name);
}

test('Chrome on Android invite produces the intent URL', () => {
  const result = route('/invite/' + code, chromeAndroid, playBadgeHref, true);
  assert.strictEqual(result.ctaUrl,
    'intent://invite/ABCD2345#Intent;scheme=connectmerge;package=com.kidd.connect_merge;' +
    'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.kidd.connect_merge%26referrer%3Dcode%253DABCD2345;end');
});

test('fallback referrer round-trips to the literal friend code', () => {
  const result = route('/invite/' + code, chromeAndroid, playBadgeHref, true);
  const encodedFallback = result.ctaUrl.split('S.browser_fallback_url=')[1].split(';end')[0];
  const chromeDecodedUrl = decodeURIComponent(encodedFallback);
  assert.strictEqual(new URL(chromeDecodedUrl).searchParams.get('referrer'), 'code=ABCD2345');
});

test('invite tolerates a missing Play badge URL', () => {
  let result;
  assert.doesNotThrow(() => {
    result = route('/invite/' + code, chromeAndroid, null, true);
  });
  assert.deepStrictEqual(result, {
    kind: 'invite',
    deepLink: 'connectmerge://invite/ABCD2345',
    ctaUrl: 'connectmerge://invite/ABCD2345',
    storeUrl: null
  });
});

test('invite tolerates an unparseable Play badge URL', () => {
  let result;
  assert.doesNotThrow(() => {
    result = route('/invite/' + code, chromeAndroid, '', true);
  });
  assert.deepStrictEqual(result, {
    kind: 'invite',
    deepLink: 'connectmerge://invite/ABCD2345',
    ctaUrl: 'connectmerge://invite/ABCD2345',
    storeUrl: null
  });
});

test('unpublished app uses the plain scheme', () => {
  const result = route('/invite/' + code, chromeAndroid, playBadgeHref, false);
  assert.strictEqual(result.ctaUrl, 'connectmerge://invite/ABCD2345');
});

test('only boolean true enables the intent CTA', () => {
  const result = route('/invite/' + code, chromeAndroid, playBadgeHref, 'false');
  assert.strictEqual(result.ctaUrl, 'connectmerge://invite/ABCD2345');
});

test('Facebook and Instagram webviews use the plain scheme', () => {
  const facebook = chromeAndroid + ' [FBAN/FB4A;FBAV/500.0.0.0.0]';
  const instagram = chromeAndroid + ' Instagram 340.0.0.0.0 Android';
  assert.strictEqual(route('/invite/' + code, facebook, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
  assert.strictEqual(route('/invite/' + code, instagram, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
});

test('generic Android WebView uses the plain scheme', () => {
  const webview = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) ' +
    'AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36';
  assert.strictEqual(route('/invite/' + code, webview, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
});

test('Version 4 Android WebView uses the plain scheme', () => {
  const webview = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 ' +
    'Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36';
  assert.strictEqual(route('/invite/' + code, webview, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
});

test('unknown Android browser uses the plain scheme', () => {
  const unknown = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 DuckDuckGo/5 Mobile Safari/537.36';
  assert.strictEqual(route('/invite/' + code, unknown, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
});

test('iOS and desktop use the plain scheme', () => {
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1';
  const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36';
  assert.strictEqual(route('/invite/' + code, ios, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
  assert.strictEqual(route('/invite/' + code, desktop, playBadgeHref, true).ctaUrl,
    'connectmerge://invite/ABCD2345');
});

test('Firefox, Samsung Internet, and Edge Android use intent URLs', () => {
  const browsers = [
    'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/26.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 EdgA/126.0 Mobile Safari/537.36'
  ];
  browsers.forEach((userAgent) => {
    assert.match(route('/invite/' + code, userAgent, playBadgeHref, true).ctaUrl, /^intent:\/\/invite\//);
  });
});

test('duel route exposes decoded display fields and no store URL', () => {
  const result = route('/duel/duel-id/hard/42/Alice%20Smith', chromeAndroid, playBadgeHref, true);
  assert.deepStrictEqual(result, {
    kind: 'duel',
    deepLink: 'connectmerge://duel/duel-id/hard/42/Alice%20Smith',
    ctaUrl: 'connectmerge://duel/duel-id/hard/42/Alice%20Smith',
    storeUrl: null,
    name: 'Alice Smith',
    score: '42',
    difficultyLabel: 'Hard'
  });
});

test('malformed percent escape in duel name returns null', () => {
  let result;
  assert.doesNotThrow(() => {
    result = route('/duel/duel-id/hard/42/Alice%ZZ', chromeAndroid, playBadgeHref, true);
  });
  assert.strictEqual(result, null);
});

test('invalid invite code returns null', () => {
  assert.strictEqual(route('/invite/INVALID1', chromeAndroid, playBadgeHref, true), null);
});

console.log(passed + ' tests passed');
