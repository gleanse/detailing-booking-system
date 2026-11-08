const STAFF_NAV = [
  { label: 'Board', href: '/staff/dashboard', icon: 'ph-squares-four' },
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
  'beforeend',
  `<nav aria-label="Staff navigation" class="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-neutral-950 md:hidden">
    ${STAFF_NAV.map(mobileItem).join('')}
  </nav>
  <aside class="fixed bottom-0 left-0 top-16 z-40 hidden w-56 flex-col gap-1 border-r border-white/10 bg-neutral-950 p-4 md:flex">
    ${STAFF_NAV.map(railItem).join('')}
  </aside>`,
);
