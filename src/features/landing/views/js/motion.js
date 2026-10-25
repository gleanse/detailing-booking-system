const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

function splitWords(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = text
    .split(/\s+/)
    .map(
      (word) =>
        `<span class="inline-block overflow-hidden align-bottom py-1 -my-1" aria-hidden="true"><span class="inline-block" data-word>${word}</span></span>`,
    )
    .join(' ');
}

function playHero() {
  const status = document.querySelector('[data-status]');
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('[data-word]', { yPercent: 110, duration: 0.9, stagger: 0.07 })
    .from(
      '[data-reveal]',
      { y: 16, opacity: 0, duration: 0.7, stagger: 0.1 },
      '-=0.5',
    )
    .from('[data-card]', { y: 28, opacity: 0, duration: 0.9 }, '-=0.7')
    .to(
      '[data-progress]',
      { scaleX: 0.5, duration: 1.1, ease: 'power2.inOut' },
      '-=0.2',
    )
    .fromTo(
      '[data-gloss]',
      { xPercent: -120 },
      { xPercent: 420, duration: 1.2, ease: 'power2.inOut' },
      '-=0.9',
    )
    .call(
      () => {
        if (status) status.textContent = 'In progress';
      },
      null,
      '-=0.6',
    );
}

const title = document.querySelector('[data-split]');
if (title) splitWords(title);

if (reduceMotion) {
  gsap.set('[data-progress]', { scaleX: 0.5 });
  const status = document.querySelector('[data-status]');
  if (status) status.textContent = 'In progress';
} else {
  playHero();
}
