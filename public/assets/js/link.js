// Flip to true at public launch to restore the primary "Open in app" CTA styling.
var APP_PUBLISHED = false;

function route(pathname, userAgent, playBadgeHref, appPublished) {
  var segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'duel' && segments.length >= 5) {
    var name;
    try {
      name = decodeURIComponent(segments[4]);
    } catch (error) {
      return null;
    }
    var score = segments[3];
    var difficulty = segments[2];
    var difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    var duelDeepLink = 'connectmerge://duel/' + segments.slice(1).join('/');
    return {
      kind: 'duel',
      deepLink: duelDeepLink,
      ctaUrl: duelDeepLink,
      storeUrl: null,
      name: name,
      score: score,
      difficultyLabel: difficultyLabel
    };
  }
  if (segments[0] === 'invite' && segments.length >= 2 && /^[A-Z2-7]{8}$/.test(segments[1])) {
    var code = segments[1];
    var deepLink = 'connectmerge://invite/' + code;
    var storeUrl = null;
    try {
      var playUrl = new URL(playBadgeHref);
      playUrl.searchParams.set('referrer', 'code=' + code);
      storeUrl = playUrl.toString();
    } catch (error) {
      // No usable badge href — leave storeUrl null so the CTA stays on the plain scheme.
    }
    var ctaUrl = deepLink;
    var isIntentCapable = /Android/.test(userAgent) &&
      /Chrome\/|Firefox\/|SamsungBrowser\/|EdgA\//.test(userAgent) &&
      !/; wv\)|Version\/4\.0|FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp/i.test(userAgent);

    if (appPublished === true && isIntentCapable && storeUrl) {
      // The referrer is already encoded once; Chrome decodes this whole-URL encoding.
      ctaUrl = 'intent://invite/' + code +
        '#Intent;scheme=connectmerge;package=com.kidd.connect_merge;' +
        'S.browser_fallback_url=' + encodeURIComponent(storeUrl) + ';end';
    }

    return { kind: 'invite', deepLink: deepLink, ctaUrl: ctaUrl, storeUrl: storeUrl };
  }
  return null;
}

if (typeof module !== 'undefined') module.exports = { route: route };

if (typeof document !== 'undefined') {
  document.getElementById('year').textContent = new Date().getFullYear();

  var headlineEl = document.getElementById('headline');
  var sublineEl = document.getElementById('subline');
  var playAnchor = document.querySelector('.store-badges a[href*="play.google.com"]');
  var result = route(location.pathname, navigator.userAgent,
    playAnchor ? playAnchor.href : null, APP_PUBLISHED);

  if (result && result.kind === 'duel') {
    headlineEl.textContent = result.name + ' challenged you to beat ' + result.score +
      ' on ' + result.difficultyLabel + '.';
    sublineEl.textContent = 'Open Connect Merge to accept the duel.';
  } else if (result && result.kind === 'invite') {
    headlineEl.textContent = "You've been invited to Connect Merge.";
    sublineEl.textContent = 'Open Connect Merge to accept the invite.';
    if (playAnchor && result.storeUrl) playAnchor.href = result.storeUrl;
  } else {
    headlineEl.textContent = 'Connect Merge';
    sublineEl.textContent = 'A chain-merge puzzle — everyone plays the same board, every day.';
  }

  var openBtn = document.getElementById('open-app-btn');
  function attemptOpen() {
    if (result) window.location = result.deepLink;
  }
  function openCta() {
    if (result) window.location = result.ctaUrl;
  }
  if (result) {
    attemptOpen();
    openBtn.addEventListener('click', openCta);
  } else {
    openBtn.setAttribute('hidden', '');
  }

  if (!APP_PUBLISHED) {
    document.getElementById('fallback').removeAttribute('hidden');
    openBtn.textContent = 'Already have the app? Try opening it';
    openBtn.classList.remove('btn-primary');
    openBtn.classList.add('btn-ghost');
  }
}
