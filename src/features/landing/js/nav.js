const toggle = document.getElementById('menu-toggle');
const menu = document.getElementById('mobile-menu');
const bar1 = document.getElementById('bar1');
const bar2 = document.getElementById('bar2');
const bar3 = document.getElementById('bar3');
let menuOpen = false;
toggle.addEventListener('click', () => {
  menuOpen = !menuOpen;
  menu.classList.toggle('open', menuOpen);
  bar1.style.transform = menuOpen ? 'translateY(6px) rotate(45deg)' : '';
  bar2.style.opacity = menuOpen ? '0' : '';
  bar3.style.transform = menuOpen ? 'translateY(-6px) rotate(-45deg)' : '';
});

async function updateNav() {
  try {
    const res = await fetch('/api/customer/me');
    const json = await res.json();
    if (!json.success) return;
    const u = json.user;
    const firstName = u.name.split(' ')[0];

    const desktopNav = document.querySelector('nav.hidden.md\\:flex');
    if (desktopNav) {
      const accountLink = desktopNav.querySelector('a[href="/customer/login"]');
      if (accountLink) {
        accountLink.href = '/customer/account';
        accountLink.innerHTML = `<i class="ph ph-user-circle text-red-500 text-base"></i> ${firstName}`;
        accountLink.className =
          'nav-link text-sm text-white flex items-center gap-1.5';
      }
    }

    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
      const accountLink = mobileMenu.querySelector('a[href="/customer/login"]');
      if (accountLink) {
        accountLink.href = '/customer/account';
        accountLink.textContent = `Hi, ${firstName}`;
        accountLink.className =
          'py-4 text-base text-white border-b border-white/5';
      }
    }
  } catch {
    // fail silently
  }
}

updateNav();
