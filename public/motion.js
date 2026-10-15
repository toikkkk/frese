(() => {
  'use strict';
  window.__freseReady = true;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const root = document.documentElement;
  const { gsap, ScrollTrigger } = window;
  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const endLoading = () => root.classList.remove('anim', 'is-loading');

  if (!gsap || !ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    endLoading();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  /* ---------- Utilitas ---------- */
  function splitChars(element) {
    element.setAttribute('aria-label', element.textContent.trim());
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          [...child.textContent].forEach((char) => {
            if (char === ' ') { fragment.append(' '); return; }
            const span = document.createElement('span');
            span.className = 'char';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = char;
            fragment.append(span);
          });
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
      });
    };
    walk(element);
    return qa('.char', element);
  }
  const reveal = (trigger, targets, vars = {}, start = 'top 85%') => gsap.from(targets, {
    y: 32, opacity: 0, duration: 0.8, stagger: 0.12, ...vars,
    scrollTrigger: { trigger, start, once: true },
  });

  /* ---------- Preloader: logo FRESE tersusun huruf demi huruf ---------- */
  function runPreloader(hero) {
    window.scrollTo(0, 0);
    const preloader = q('#preloader');
    const letters = qa('[data-pl-letter]');
    let finished = false;

    gsap.set(letters, { yPercent: -170, rotation: () => gsap.utils.random(-16, 16), opacity: 0, transformOrigin: '50% 100%' });
    gsap.set('.pl-leaf', { scale: 0, rotation: -40, opacity: 0, transformOrigin: '6% 94%' });
    gsap.set('.pl-rule', { scaleX: 0, transformOrigin: '50% 50%' });
    gsap.set('.pl-tag', { clipPath: 'inset(0 100% 0 0)', y: 8, opacity: 0 });
    gsap.set('.preloader__spark', { scale: 0, rotation: -90 });
    gsap.set('.preloader__glow', { scale: 0.4, opacity: 0 });

    const intro = gsap.timeline();
    intro
      .to('.preloader__glow', { scale: 1, opacity: 1, duration: 1.4, ease: 'power2.out' }, 0)
      .to('.preloader__bar span', { scaleX: 1, duration: 2.5, ease: 'none' }, 0)
      .to(letters, { yPercent: 0, opacity: 1, rotation: 0, duration: 0.85, ease: 'bounce.out', stagger: 0.1 }, 0.15)
      .to(letters, { scaleY: 0.9, scaleX: 1.05, duration: 0.13, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.07 }, 0.95)
      .to('.pl-leaf', { scale: 1, rotation: 0, opacity: 1, duration: 1.1, ease: 'elastic.out(1,0.5)' }, 1.0)
      .to('.pl-leaf', { rotation: 5, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 1.9)
      .to('.preloader__spark', { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(3)', stagger: 0.12 }, 1.2)
      .to('.pl-rule', { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, 1.5)
      .to('.pl-tag', { clipPath: 'inset(0 0% 0 0)', y: 0, opacity: 1, duration: 0.9, ease: 'power2.out' }, 1.75)
      .to('.preloader__spark', { y: -8, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.1 }, 2.0)
      .add(() => leave(false), 3.0);
    intro.timeScale(1.4);

    function leave(fast) {
      if (finished) return;
      finished = true;
      intro.kill();
      const t = fast ? 0.4 : 1;
      const logo = q('.preloader__logo');
      const target = q('.site-header .brand img');
      const from = logo.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const scale = to.width / from.width;
      const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      gsap.set(target, { opacity: 0 });
      gsap.set(logo, { transformOrigin: '50% 50%' });
      const exit = gsap.timeline({
        onComplete: () => {
          gsap.set(target, { opacity: 1 });
          gsap.set(preloader, { display: 'none' });
          endLoading();
          ScrollTrigger.refresh();
        },
      });
      exit
        /* hiasan memudar, latar krem terbuka perlahan */
        .to('.preloader__bar, .preloader__skip, .preloader__spark, .preloader__glow', { opacity: 0, duration: 0.35 * t }, 0)
        .to(logo, { scale: 1.08, duration: 0.3 * t, ease: 'power2.out' }, 0)
        .to(preloader, { backgroundColor: 'rgba(250,249,244,0)', duration: 1.1 * t, ease: 'power1.inOut' }, 0.35 * t)
        /* logo terbang mengecil ke posisi logo di navbar */
        .to(logo, { x: dx, y: dy, scale, duration: 1.35 * t, ease: 'power2.inOut' }, 0.35 * t)
        .add(() => hero.play(), 0.6 * t);
    }
    q('#preloader-skip').addEventListener('click', () => leave(true));
  }

  /* ---------- Intro halaman ---------- */
  function buildHero() {
    const chars = splitChars(q('.poster__title h1'));
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    tl.from('.announcement', { yPercent: -100, duration: 0.4 })
      .from('.site-header .main-nav a, .site-header .header-actions > *', { y: -10, opacity: 0, duration: 0.5, stagger: 0.05 }, '<0.05')
      .from('.poster__meta span', { opacity: 0, duration: 0.5, stagger: 0.08 }, '-=0.3')
      .from('.poster__kicker, .poster__description, .poster__scents', { y: 16, opacity: 0, duration: 0.6, stagger: 0.08 }, '-=0.3')
      .from('.poster__art img', { y: 24, opacity: 0, duration: 0.8 }, '-=0.5')
      .from('.poster__orbit, .poster__art-note', { opacity: 0, duration: 0.8 }, '<')
      .from('.poster__title > p', { opacity: 0, duration: 0.5 }, '-=0.5')
      .from(chars, { y: 20, opacity: 0, duration: 0.55, stagger: 0.025 }, '<')
      .from('.poster__signature, .poster__side span, .poster__cta', { opacity: 0, duration: 0.5, stagger: 0.06 }, '-=0.3')
      .from('.ticker', { opacity: 0, duration: 0.5 }, '-=0.4');
    tl.timeScale(1.3);
    return tl;
  }

  /* ---------- Ticker berjalan ---------- */
  function marquee() {
    const ticker = q('.ticker');
    const group = document.createElement('div');
    group.className = 'ticker__group';
    group.append(...ticker.childNodes);
    const track = document.createElement('div');
    track.className = 'ticker__track';
    track.setAttribute('aria-hidden', 'true');
    const copies = 4;
    for (let i = 0; i < copies; i += 1) track.append(group.cloneNode(true));
    ticker.classList.add('is-marquee');
    ticker.replaceChildren(track);
    gsap.to(track, { xPercent: -100 / copies, duration: 34, ease: 'none', repeat: -1 });
  }

  /* ---------- Animasi tiap section saat di-scroll ---------- */
  function sections() {
    /* Koleksi */
    ['#aroma', '#galeri'].forEach((id) => {
      const heading = q(`${id} .section-heading`);
      reveal(heading, qa('.eyebrow, h2, .section-heading__note', heading));
      gsap.from(qa('.eyebrow__line', heading), {
        scaleX: 0, transformOrigin: 'left center', duration: 0.8, delay: 0.1,
        scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
      });
    });

    const cards = qa('.product-card');
    gsap.set(cards, { opacity: 0, y: 70, rotation: 1.4 });
    ScrollTrigger.batch(cards, {
      start: 'top 90%', once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, rotation: 0, duration: 0.95, stagger: 0.16, ease: 'power3.out', clearProps: 'transform' }),
    });
    qa('.product-card__photo img').forEach((img) => {
      gsap.set(img, { scale: 1.05 });
      gsap.fromTo(img, { yPercent: -2.5 }, {
        yPercent: 2.5, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    qa('.product-card__index, .scent-tag').forEach((el) => gsap.from(el, {
      x: -12, opacity: 0, duration: 0.6, delay: 0.3,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    }));

    /* Galeri */
    qa('.gallery__item').forEach((figure, index) => {
      qa('.gallery__frame', figure).forEach((frame, n) => {
        const img = q('img', frame);
        gsap.set(frame, { clipPath: 'inset(100% 0% 0% 0%)' });
        gsap.set(img, { scale: 1.12 });
        gsap.timeline({ scrollTrigger: { trigger: frame, start: 'top 88%', once: true } })
          .to(frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut', delay: (index + n) * 0.08 })
          .to(img, { scale: 1, duration: 1.4, ease: 'power2.out' }, '<');
      });
      gsap.from(q('figcaption', figure), { y: 12, opacity: 0, duration: 0.6, scrollTrigger: { trigger: figure, start: 'top 80%', once: true } });
    });
    reveal('.gallery__notes', qa('.gallery__notes li'), { y: 24, stagger: 0.15 });

    /* Ritual */
    const ritual = q('#tentang');
    reveal(ritual, qa('.ritual__content > *'), { y: 28 }, 'top 70%');
    gsap.from('.ritual .eyebrow__line', { scaleX: 0, transformOrigin: 'left center', duration: 0.8, scrollTrigger: { trigger: ritual, start: 'top 70%', once: true } });
    gsap.from('.ritual .slider', { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: ritual, start: 'top 65%', once: true } });
    gsap.from('.ritual__stamp', {
      scale: 0, rotation: -120, duration: 1, ease: 'back.out(1.8)',
      scrollTrigger: { trigger: ritual, start: 'top 55%', once: true },
      onComplete: () => gsap.to('.ritual__stamp', { rotation: '+=360', duration: 48, ease: 'none', repeat: -1 }),
    });
    gsap.to('.ritual__ornament', { rotation: 40, yPercent: -12, ease: 'none', scrollTrigger: { trigger: ritual, start: 'top bottom', end: 'bottom top', scrub: true } });

    /* Cara memesan: muncul pelan dari bawah, berurutan */
    const howto = q('.howto');
    gsap.from('.howto .eyebrow', { opacity: 0, y: 12, duration: 0.7, scrollTrigger: { trigger: howto, start: 'top 80%', once: true } });
    gsap.from('.howto__step', { y: 20, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '.howto__steps', start: 'top 88%', once: true } });

    /* Penutup: tanpa animasi masuk, teks langsung tampil */
    const closing = q('.closing-cta');
    gsap.to('.closing-cta__flower', { rotation: 200, ease: 'none', scrollTrigger: { trigger: closing, start: 'top bottom', end: 'bottom top', scrub: true } });

    /* Section bertumpuk: yang tertutup mengecil dan meredup (semua ukuran layar) */
    [['#tentang', '.stack-panel'], ['.stack-panel', '.closing-cta']].forEach(([covered, cover]) => {
      gsap.fromTo(covered, { scale: 1, filter: 'brightness(1)', transformOrigin: '50% 100%' }, {
        scale: 0.97, filter: 'brightness(0.86)', ease: 'none',
        scrollTrigger: { trigger: cover, start: 'top bottom', end: 'top top', scrub: true },
      });
    });

    /* Footer */
    gsap.from('.site-footer > *', { y: 20, opacity: 0, duration: 0.7, stagger: 0.12, scrollTrigger: { trigger: '.site-footer', start: 'top 95%', once: true } });
  }

  /* ---------- Interaksi pesanan (dipanggil dari app.js) ---------- */
  function bump(selector) {
    const el = q(selector);
    if (!el || el.hidden) return;
    gsap.fromTo(el, { scale: 1 }, { scale: 1.35, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: 'auto' });
  }
  window.FreseMotion = {
    tap(el) {
      gsap.fromTo(el, { scale: 0.82 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: 'auto' });
    },
    addToCart(button) {
      gsap.fromTo(button, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', overwrite: 'auto' });
      const from = button.getBoundingClientRect();
      const target = q('#cart-count').getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'fly-dot';
      dot.textContent = '✿';
      document.body.append(dot);
      const sx = from.left + from.width / 2 - 14;
      const sy = from.top + from.height / 2 - 14;
      const ex = target.left + target.width / 2 - 14;
      const ey = target.top + target.height / 2 - 14;
      gsap.set(dot, { x: sx, y: sy, scale: 0.4 });
      gsap.timeline({ onComplete: () => { dot.remove(); bump('#cart-count'); bump('#cart-badge'); } })
        .to(dot, { scale: 1.1, duration: 0.2, ease: 'back.out(3)' }, 0)
        .to(dot, { x: ex, duration: 0.75, ease: 'power1.inOut' }, 0.05)
        .to(dot, { y: ey, duration: 0.75, ease: 'back.in(1.1)' }, 0.05)
        .to(dot, { rotation: 300, scale: 0.55, duration: 0.75, ease: 'none' }, 0.05);
    },
    view(name) {
      const view = q(`.ck-view[data-view="${name}"]`);
      if (!view) return;
      const items = name === 'done'
        ? qa('.ck-done__check, h2, p, .button', view)
        : qa('.checkout__head, .ck-item, .pay-option, .pay__amount, .pay__qr, .pay__lead', view);
      gsap.from(items, { y: 14, opacity: 0, duration: 0.5, stagger: 0.07, clearProps: 'transform,opacity' });
    },
  };

  /* ---------- Navbar: beri bayangan saat menempel ---------- */
  const header = q('.site-header');
  ScrollTrigger.create({ start: 80, end: 'max', onToggle: (self) => header.classList.toggle('is-stuck', self.isActive) });

  /* ---------- Mulai ---------- */
  marquee();
  runPreloader(buildHero());
  sections();
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
