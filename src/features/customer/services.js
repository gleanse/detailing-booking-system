const container = document.getElementById('services');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatPeso = (value) => `₱${Number(value).toLocaleString()}`;

const renderChips = (variants) => {
  const list = (variants || []).filter((v) => v && v.id);
  const shown = list
    .slice(0, 3)
    .map(
      (v) =>
        `<span class="rounded-full bg-white/7 px-2.5 py-0.5 text-xs text-white/70">${escapeHtml(v.name)}</span>`,
    )
    .join('');
  const extra =
    list.length > 3
      ? `<span class="rounded-full bg-white/7 px-2.5 py-0.5 text-xs text-white/70">+${list.length - 3}</span>`
      : '';
  return shown + extra;
};

const renderService = (service, i) => `
  <a href="/booking/${service.id}"
    class="animate-card group flex items-center gap-3 rounded-2xl border border-white/6 bg-neutral-900 p-3 transition-all duration-200 hover:border-red-500/40 active:scale-98 sm:gap-5 sm:p-4"
    style="animation-delay:${i * 0.08}s">
    <div class="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-red-950 to-neutral-900 sm:size-24">
      <i class="ph ph-wrench text-2xl text-white/15 sm:text-4xl"></i>
      ${
        service.image_url
          ? `<img data-fallback src="${escapeHtml(service.image_url)}" alt="" class="absolute inset-0 size-full object-cover">`
          : ''
      }
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-base font-medium text-white sm:text-lg">${escapeHtml(service.name)}</h3>
        <p class="whitespace-nowrap text-sm font-medium text-red-400 sm:hidden">From ${formatPeso(service.price)}</p>
      </div>
      <p class="mt-0.5 hidden truncate text-sm text-white/50 sm:block">${escapeHtml(service.description)}</p>
      <p class="mt-0.5 text-xs text-white/40 sm:hidden">Down payment ${formatPeso(service.down_payment_amount)}</p>
      <div class="mt-2 flex flex-wrap gap-1.5">${renderChips(service.variants)}</div>
    </div>

    <div class="hidden shrink-0 flex-col items-end text-right sm:flex">
      <p class="font-medium text-red-400">From ${formatPeso(service.price)}</p>
      <p class="mt-0.5 text-xs text-white/45">Down payment ${formatPeso(service.down_payment_amount)}</p>
      <span class="mt-3 rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-red-700">Select</span>
    </div>

    <i class="ph ph-caret-right text-white/30 sm:hidden"></i>
  </a>`;

const showMessage = (text) => {
  container.innerHTML = `<p class="py-10 text-center text-sm text-white/30">${text}</p>`;
};

fetch('/api/services/list')
  .then((res) => res.json())
  .then((data) => {
    if (!data.data || data.data.length === 0) {
      showMessage('No services available right now.');
      return;
    }
    container.innerHTML = data.data.map(renderService).join('');
    container.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => img.remove());
    });
  })
  .catch(() => showMessage('Could not load services. Please refresh.'));
