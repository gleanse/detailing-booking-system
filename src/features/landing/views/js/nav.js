const toggle = document.getElementById('menu-toggle');
const menu = document.getElementById('mobile-menu');
const bars = [
  document.getElementById('bar1'),
  document.getElementById('bar2'),
  document.getElementById('bar3'),
];

bars.forEach((bar) => {
  bar.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
});

function setMenu(open) {
  menu.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  bars[0].style.transform = open ? 'translateY(6px) rotate(45deg)' : '';
  bars[1].style.opacity = open ? '0' : '';
  bars[2].style.transform = open ? 'translateY(-6px) rotate(-45deg)' : '';
}

toggle.addEventListener('click', () => {
  setMenu(!menu.classList.contains('open'));
});

menu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('click', (e) => {
  const outside = !menu.contains(e.target) && !toggle.contains(e.target);
  if (menu.classList.contains('open') && outside) setMenu(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
});

window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
  if (e.matches) setMenu(false);
});

async function updateNav() {
  try {
    const res = await fetch('/api/customer/me');
    const json = await res.json();
    if (!json.success) return;
    const firstName = json.user.name.split(' ')[0];

    const desktopLink = document.querySelector(
      'header nav a[href="/customer/login"]',
    );
    if (desktopLink) {
      const icon = document.createElement('i');
      icon.className = 'ph ph-user-circle text-red-500 text-base';
      desktopLink.href = '/customer/account';
      desktopLink.className =
        'nav-link text-sm text-white flex items-center gap-1.5';
      desktopLink.replaceChildren(icon, document.createTextNode(firstName));
    }

    const mobileLink = menu.querySelector('a[href="/customer/login"]');
    if (mobileLink) {
      mobileLink.href = '/customer/account';
      mobileLink.textContent = `Hi, ${firstName}`;
      mobileLink.className =
        'py-4 text-base text-white border-b border-white/5';
    }
  } catch {
    // fail silently
  }
}

updateNav();
