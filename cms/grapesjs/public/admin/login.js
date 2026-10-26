(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submit = form.querySelector('button[type="submit"]');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    submit.disabled = true;

    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');

    if (!username || !password) {
      showError('Enter both username and password.');
      submit.disabled = false;
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'same-origin',
      });
      if (res.ok) {
        window.location.replace('/admin');
        return;
      }
      let message = 'Sign-in failed.';
      try {
        const payload = await res.json();
        if (payload && payload.error && payload.error.message) message = payload.error.message;
      } catch {
        // Keep the generic message.
      }
      if (res.status === 429) message = 'Too many attempts. Wait a few minutes and try again.';
      showError(message);
    } catch {
      showError('The local server did not respond.');
    } finally {
      submit.disabled = false;
    }
  });
})();
