const STAFF_NAV = [
  { label: 'Board', href: '/staff/dashboard', icon: 'ph-squares-four' },
  { label: 'Scan', href: '/staff/scan', icon: 'ph-qr-code' },
  { label: 'Walk-in', href: '/staff/walkin', icon: 'ph-user-plus' },
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isActive = (href) => window.location.pathname.startsWith(href);

const mobileItem = ({ label, href, icon }) => {
  const active = isActive(href);
  return `<a href="${href}" class="flex flex-1 flex-col items-center gap-1 py-2 text-xs ${active ? 'text-red-500' : 'text-white/40'}">
    <i class="ph ${icon} text-xl"></i>
    ${label}
  </a>`;
};

const railItem = ({ label, href, icon }) => {
  const active = isActive(href);
  return `<a href="${href}" class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'bg-red-500/10 text-red-500' : 'text-white/40 hover:text-white'}">
    <i class="ph ${icon} text-lg"></i>
    ${label}
  </a>`;
};

document.body.classList.add('pb-20', 'md:pb-0', 'md:pl-56');
document.body.insertAdjacentHTML(
  'afterbegin',
  `<header class="sticky top-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 bg-neutral-950 border-b border-white/10">
    <div class="flex items-center gap-2">
      <svg class="w-7 h-7 text-red-500" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="M18 2l14 8v16l-14 8L4 26V10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M12.5 11v14M23.5 11v14M12.5 18h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="text-white text-base tracking-widest" style="font-family:'Bebas Neue',sans-serif;">HERCO</span>
    </div>
    <a href="/staff/account" id="btn-account" aria-label="Account"
      class="w-8 h-8 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold flex items-center justify-center">··</a>
  </header>`,
);

fetch('/staff/me')
  .then((res) => res.json())
  .then((data) => {
    if (!data.success) return;
    const initials = data.user.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    document.getElementById('btn-account').textContent = initials;
  })
  .catch(() => {});
document.body.insertAdjacentHTML(
  'beforeend',
  `<nav aria-label="Staff navigation" class="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-neutral-950 md:hidden">
    ${STAFF_NAV.map(mobileItem).join('')}
  </nav>
  <aside class="fixed bottom-0 left-0 top-16 z-40 hidden w-56 flex-col gap-1 border-r border-white/10 bg-neutral-950 p-4 md:flex">
    ${STAFF_NAV.map(railItem).join('')}
  </aside>`,
);
