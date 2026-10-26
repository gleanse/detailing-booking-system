const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

function splitWords(el) {
  el.innerHTML = el.textContent
    .trim()
    .split(/\s+/)
    .map(
      (word) =>
        `<span class="inline-block overflow-hidden align-bottom py-1 -my-1"><span class="inline-block" data-word>${word}</span></span>`,
    )
    .join(' ');
}

function playHero() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from('[data-word]', { yPercent: 110, duration: 0.9, stagger: 0.07 })
    .from(
      '[data-reveal]',
      { y: 16, opacity: 0, duration: 0.7, stagger: 0.1 },
      '-=0.5',
    )
    .fromTo(
      '[data-sheen]',
      { xPercent: 0 },
      { xPercent: 450, duration: 1.8, ease: 'power2.inOut' },
      '-=0.6',
    );
}

document.querySelectorAll('[data-split]').forEach(splitWords);
if (!reduceMotion) playHero();
