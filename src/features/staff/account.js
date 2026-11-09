async function loadProfile() {
  try {
    const res = await fetch('/staff/me');
    const data = await res.json();
    if (!data.success) return;
    const u = data.user;
    document.getElementById('profile-name').textContent = u.name;
    document.getElementById('profile-email').textContent = u.email;
    document.getElementById('profile-role').textContent = u.role;
  } catch (err) {
    console.error('Load profile error:', err);
  }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  const res = await fetch('/staff/logout', { method: 'POST' });
  const data = await res.json();
  if (data.redirect) window.location.href = data.redirect;
});

loadProfile();
