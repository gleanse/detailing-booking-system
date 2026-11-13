/* global gsap, ScrollTrigger */
gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

// full class names stay as literals so tailwind can find them
const STATUS_STEPS = [
  { label: 'Booking confirmed', bg: 'bg-green-400' },
  { label: 'In progress', bg: 'bg-blue-400' },
  { label: 'Service complete', bg: 'bg-yellow-400' },
  { label: 'Picked up', bg: 'bg-green-400' },
];
const BAR_BASE = 'block h-1 rounded-full transition-colors duration-500';
const BAR_DONE = 'bg-white/60';
const BAR_TODO = 'bg-white/15';
const TEXT_BASE =
  'mt-2 hidden text-xs transition-colors group-hover:text-white sm:block';
const TEXT_CURRENT = 'text-white';
const TEXT_DONE = 'text-white/70';
const TEXT_TODO = 'text-white/50';

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

  tl.from('[data-word]', { yPercent: 110, duration: 0.9, stagger: 0.07 }).from(
    '[data-reveal]',
    { y: 16, opacity: 0, duration: 0.7, stagger: 0.1 },
    '-=0.5',
  );
}

function initScrollReveal() {
  const items = gsap.utils.toArray('[data-scroll]');
  gsap.set(items, { opacity: 0, y: 24 });

  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        overwrite: true,
        clearProps: 'transform,opacity',
      }),
  });
}

function initHeroSlides() {
  const wrap = document.querySelector('[data-hero-slides]');
  if (!wrap) return;

  const slides = wrap.querySelectorAll('[data-slide]');
  const dots = wrap.querySelectorAll('[data-dot]');
  let current = 0;
  let timer = null;

  function show(index) {
    current = index;
    slides.forEach((slide, i) => {
      slide.classList.toggle('opacity-100', i === index);
      slide.classList.toggle('opacity-0', i !== index);
    });
    dots.forEach((dot, i) => {
      const mark = dot.firstElementChild;
      mark.classList.toggle('bg-white', i === index);
      mark.classList.toggle('bg-white/40', i !== index);
    });
  }

  function stop() {
    clearInterval(timer);
  }

  function start() {
    stop();
    if (reduceMotion) return;
    timer = setInterval(() => show((current + 1) % slides.length), 4500);
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      show(i);
      start();
    });
  });
  wrap.addEventListener('mouseenter', stop);
  wrap.addEventListener('mouseleave', start);
  start();
}

function initStatusCard() {
  const card = document.querySelector('[data-status-card]');
  if (!card) return;

  const steps = card.querySelectorAll('[data-step]');
  const label = card.querySelector('[data-status-label]');
  const dot = card.querySelector('[data-status-dot]');
  let current = 0;
  let timer = null;

  function render(index) {
    current = index;
    label.textContent = STATUS_STEPS[index].label;
    dot.className = `size-2 rounded-full transition-colors duration-500 ${STATUS_STEPS[index].bg}`;

    steps.forEach((step, i) => {
      const bar = step.querySelector('[data-bar]');
      const text = step.querySelector('[data-step-label]');
      const done = i < index;
      const isCurrent = i === index;

      let barColor = BAR_TODO;
      if (done) barColor = BAR_DONE;
      if (isCurrent) barColor = STATUS_STEPS[i].bg;

      let textColor = TEXT_TODO;
      if (done) textColor = TEXT_DONE;
      if (isCurrent) textColor = TEXT_CURRENT;

      bar.className = `${BAR_BASE} ${barColor}`;
      text.className = `${TEXT_BASE} ${textColor}`;

      if (isCurrent) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  }

  function stop() {
    clearInterval(timer);
  }

  function start() {
    stop();
    if (reduceMotion) return;
    timer = setInterval(
      () => render((current + 1) % STATUS_STEPS.length),
      2600,
    );
  }

  steps.forEach((step, i) => {
    step.addEventListener('click', () => {
      render(i);
      start();
    });
  });
  card.addEventListener('mouseenter', stop);
  card.addEventListener('mouseleave', start);
  render(0);
  start();
}

if (!reduceMotion) {
  document.querySelectorAll('[data-split]').forEach(splitWords);
  playHero();
  initScrollReveal();
}

initHeroSlides();
initStatusCard();

window.addEventListener('load', () => ScrollTrigger.refresh());
