gsap.registerPlugin(ScrollTrigger);

const PIN_HERO = false; // true: sticky hero, false: non-sticky hero

function createWindStreaks() {
  const windLayer = document.getElementById('windLayer');
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div');
    s.className = 'wind-streak';
    s.style.top = Math.random() * 100 + '%';
    s.style.width = 60 + Math.random() * 180 + 'px';
    s.style.animationDuration = 1.8 + Math.random() * 3 + 's';
    s.style.animationDelay = Math.random() * -6 + 's';
    s.style.opacity = 0.2 + Math.random() * 0.5;
    windLayer.appendChild(s);
  }
}

function playEntrance() {
  gsap.to('#heroContent', {
    opacity: 1,
    x: 0,
    duration: 1,
    delay: 0.2,
    ease: 'power3.out',
    startAt: { x: -60 },
  });
}

function initScrollDrive() {
  const tremble = gsap.to('#heroContentTremble', {
    y: '+=2',
    duration: 0.06,
    repeat: -1,
    yoyo: true,
    ease: 'none',
    paused: true,
  });

  ScrollTrigger.create({
    trigger: '#heroGlow',
    start: 'top top',
    end: '+=500',
    pin: PIN_HERO,
    scrub: 0.3,
    onUpdate: (self) => {
      // exit fully completes by 85% of the scroll range,
      // giving it more time to gradually fade before disappearing
      const exitProgress = Math.min(1, self.progress / 0.85);

      gsap.set('#heroContent', {
        x: exitProgress * 400,
        opacity: 1 - exitProgress,
        scale: 1 - exitProgress * 0.05,
      });

      // ticket exits the same way, slightly delayed so it trails the text
      const ticketExit = Math.min(
        1,
        Math.max(0, (self.progress - 0.08) / 0.85),
      );
      gsap.set('.ticket-stub', {
        x: ticketExit * 300,
        opacity: 1 - ticketExit,
        scale: 1 - ticketExit * 0.05,
      });

      if (self.progress > 0.02 && exitProgress < 0.98) {
        if (tremble.paused()) tremble.play();
      } else {
        tremble.pause(0);
      }
    },
  });
}

createWindStreaks();
playEntrance();
initScrollDrive();
