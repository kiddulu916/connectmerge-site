document.getElementById('year').textContent = new Date().getFullYear();

// Flip to true at public launch to restore the primary "Open in app" CTA styling.
var APP_PUBLISHED = false;

var segments = location.pathname.split('/').filter(Boolean);
var type = segments[0];
var headlineEl = document.getElementById('headline');
var sublineEl = document.getElementById('subline');
var deepLink = null;

if (type === 'duel' && segments.length >= 5) {
  var name = decodeURIComponent(segments[4]);
  var score = segments[3];
  var diff = segments[2];
  var diffLabel = diff.charAt(0).toUpperCase() + diff.slice(1);
  headlineEl.textContent = name + ' challenged you to beat ' + score + ' on ' + diffLabel + '.';
  sublineEl.textContent = 'Open Connect Merge to accept the duel.';
  deepLink = 'connectmerge://duel/' + segments.slice(1).join('/');
} else if (type === 'invite' && segments.length >= 2 && /^[A-Z2-7]{8}$/.test(segments[1])) {
  var code = segments[1];
  headlineEl.textContent = "You've been invited to Connect Merge.";
  sublineEl.textContent = 'Open Connect Merge to accept the invite.';
  deepLink = 'connectmerge://invite/' + code;
  // Carry the friend code through a fresh install: the Play Install Referrer
  // (read on first launch) is what auto-links the two friends. Without this the
  // code is lost across the store install.
  var playAnchor = document.querySelector('.store-badges a[href*="play.google.com"]');
  if (playAnchor) {
    playAnchor.href += (playAnchor.href.indexOf('?') === -1 ? '?' : '&') +
      'referrer=' + encodeURIComponent('code=' + code);
  }
} else {
  headlineEl.textContent = 'Connect Merge';
  sublineEl.textContent = 'A chain-merge puzzle — everyone plays the same board, every day.';
}

var openBtn = document.getElementById('open-app-btn');
function attemptOpen() {
  if (deepLink) window.location = deepLink;
}
if (deepLink) {
  attemptOpen();
  openBtn.addEventListener('click', attemptOpen);
} else {
  openBtn.setAttribute('hidden', '');
}

if (!APP_PUBLISHED) {
  document.getElementById('fallback').removeAttribute('hidden');
  openBtn.textContent = 'Already have the app? Try opening it';
  openBtn.classList.remove('btn-primary');
  openBtn.classList.add('btn-ghost');
}
