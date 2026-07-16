const ENDPOINT = 'https://nnoqqchqprfikhabrrjt.supabase.co/functions/v1/delete-account';
const form = document.getElementById('form');
const error = document.getElementById('error');
const button = document.getElementById('submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  if (document.getElementById('confirm').value.trim() !== 'DELETE') {
    error.textContent = 'Please type DELETE (in capitals) to confirm.';
    error.hidden = false;
    return;
  }
  button.disabled = true;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: document.getElementById('player-id').value.trim(),
        username: document.getElementById('username').value.trim(),
        reason: document.getElementById('reason').value.trim(),
      }),
    });
    if (!res.ok) throw new Error('bad status');
    form.style.display = 'none';
    document.getElementById('done').classList.add('is-visible');
  } catch {
    error.textContent = 'Something went wrong. Check the Player ID and try again.';
    error.hidden = false;
    button.disabled = false;
  }
});
