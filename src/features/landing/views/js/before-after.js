document.querySelectorAll('[data-compare]').forEach((el) => {
  const handle = el.querySelector('.compare-handle');
  let position = 50;
  let dragging = false;

  handle.tabIndex = 0;
  handle.setAttribute('role', 'slider');
  handle.setAttribute('aria-label', 'Compare before and after');
  handle.setAttribute('aria-valuemin', '0');
  handle.setAttribute('aria-valuemax', '100');

  function setPosition(value) {
    position = Math.min(100, Math.max(0, value));
    el.style.setProperty('--pos', `${position}%`);
    handle.setAttribute('aria-valuenow', String(Math.round(position)));
  }

  function fromPointer(e) {
    const rect = el.getBoundingClientRect();
    setPosition(((e.clientX - rect.left) / rect.width) * 100);
  }

  function endDrag(e) {
    dragging = false;
    if (el.hasPointerCapture(e.pointerId))
      el.releasePointerCapture(e.pointerId);
  }

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (dragging) fromPointer(e);
  });
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === 'ArrowLeft') setPosition(position - step);
    else if (e.key === 'ArrowRight') setPosition(position + step);
    else if (e.key === 'Home') setPosition(0);
    else if (e.key === 'End') setPosition(100);
    else return;
    e.preventDefault();
  });

  setPosition(50);
});
