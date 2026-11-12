(() => {
  const CUSTOMER_NAV = [
    { label: 'Services', href: '/customer/services' },
    { label: 'My bookings', href: '/customer/my-bookings' },
  ];

  const MENU_ITEMS = [
    { label: 'Services', href: '/customer/services', icon: 'ph-sparkle' },
    {
      label: 'My bookings',
      href: '/customer/my-bookings',
      icon: 'ph-list-bullets',
    },
    { label: 'My account', href: '/customer/account', icon: 'ph-user' },
  ];

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const path = window.location.pathname;
  const isActive = (href) => path === href || path.startsWith(href + '/');

  const buildHeader = (user) => {
    const initials = user.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const firstName = user.name.split(' ')[0];

    const navLinks = CUSTOMER_NAV.map(
      (item) =>
        `<a href="${item.href}" class="text-sm tracking-wide transition-colors ${
          isActive(item.href) ? 'text-white' : 'text-white/50 hover:text-white'
        }">${item.label}</a>`,
    ).join('');

    const menuLinks = MENU_ITEMS.map(
      (item) =>
        `<a href="${item.href}" class="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5 ${
          isActive(item.href) ? 'text-red-400' : 'text-white/70'
        }">
        <i class="ph ${item.icon} text-lg"></i>${item.label}
      </a>`,
    ).join('');

    const header = document.createElement('header');
    header.id = 'customer-header';
    header.className =
      'sticky top-0 z-50 border-b border-red-500/20 bg-neutral-950/95 backdrop-blur-md';
    header.innerHTML = `
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
      <a href="/customer/my-bookings" class="flex items-center gap-2.5" aria-label="Herco Detailing Garage, my bookings">
        <img src="/Images/herco-logo.jpeg" alt="" width="40" height="40" class="size-10 shrink-0 rounded-lg object-cover">
        <span class="flex flex-col leading-none">
          <span class="text-2xl uppercase tracking-wider text-white" style="font-family:'Bebas Neue',sans-serif;">Herco</span>
          <span class="mt-0.5 text-xs text-white/60">Detailing Garage</span>
        </span>
      </a>

      <nav class="hidden items-center gap-7 md:flex">${navLinks}</nav>

      <div class="flex items-center gap-3">
        <div class="relative">
          <button id="avatar-btn" type="button" aria-label="Account menu" aria-expanded="false"
            class="flex cursor-pointer items-center gap-2 rounded-full">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-xs font-semibold text-red-400">${escapeHtml(initials)}</span>
            <span class="hidden max-w-32 truncate text-sm text-white/70 sm:block">${escapeHtml(firstName)}</span>
            <i id="avatar-caret" class="ph ph-caret-down hidden text-sm text-white/40 transition-transform sm:block"></i>
          </button>
          <div id="avatar-menu" class="absolute right-0 top-full z-50 mt-3 hidden w-56 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
            <div class="border-b border-white/5 px-4 py-3">
              <p class="truncate text-sm font-medium text-white">${escapeHtml(user.name)}</p>
              <p class="truncate text-xs text-white/40">${escapeHtml(user.email)}</p>
            </div>
            ${menuLinks}
            <button id="btn-signout" type="button" class="flex w-full cursor-pointer items-center gap-3 border-t border-white/5 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-white/5">
              <i class="ph ph-sign-out text-lg"></i>Sign out
            </button>
          </div>
        </div>
      </div>
    </div>`;
    return header;
  };

  const wireMenu = (header) => {
    const btn = header.querySelector('#avatar-btn');
    const menu = header.querySelector('#avatar-menu');

    const setOpen = (open) => {
      menu.classList.toggle('hidden', !open);
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('#avatar-caret').classList.toggle('rotate-180', open);
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(menu.classList.contains('hidden'));
    });
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    header.querySelector('#btn-signout').addEventListener('click', async () => {
      const res = await fetch('/api/customer/logout', { method: 'POST' });
      const json = await res.json();
      if (json.success) window.location.href = json.redirect;
    });
  };

  fetch('/api/customer/me')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.success || data.user.role !== 'customer') return;
      const header = buildHeader(data.user);
      const existing = document.querySelector('header');
      if (existing) existing.replaceWith(header);
      else document.body.insertAdjacentHTML('afterbegin', header.outerHTML);
      wireMenu(document.getElementById('customer-header'));
    })
    .catch(() => {});
})();
