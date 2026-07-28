/* =======================================================
   Danilo Picicci — Portfolio demo
   Three.js (morphing particle system) + GSAP / ScrollTrigger
   ======================================================= */

(() => {
  'use strict';

  // al ricaricamento la pagina deve sempre ripartire dall'inizio,
  // non dalla posizione di scroll che il browser tenta di ripristinare
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  addEventListener('pageshow', () => scrollTo(0, 0));

  const hasGSAP  = typeof gsap !== 'undefined';
  const hasTHREE = typeof THREE !== 'undefined';
  const reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (hasGSAP && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  /* ==================================================
     1. WEBGL — nuvola di particelle che cambia forma
     ================================================== */
  const COUNT = 6500;

  function fibonacciSphere(n, R) {
    const a = new Float32Array(n * 3), phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = phi * i;
      a[i*3] = Math.cos(th) * r * R; a[i*3+1] = y * R; a[i*3+2] = Math.sin(th) * r * R;
    }
    return a;
  }

  function torusKnot(n, R, r, p, q) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = (i / n) * Math.PI * 2 * p;
      const cu = Math.cos(u), su = Math.sin(u);
      const qu = (q / p) * u, cs = Math.cos(qu) + 2;
      const tube = Math.random() * Math.PI * 2, rad = r * Math.sqrt(Math.random());
      a[i*3]   = 0.5 * cs * cu * R + Math.cos(tube) * rad;
      a[i*3+1] = 0.5 * cs * su * R + Math.sin(tube) * rad;
      a[i*3+2] = 0.5 * Math.sin(qu) * R + (Math.random() - .5) * rad;
    }
    return a;
  }

  function cubeShell(n, s) {
    const a = new Float32Array(n * 3), h = s / 2;
    for (let i = 0; i < n; i++) {
      const face = Math.floor(Math.random() * 6);
      const u = (Math.random() - .5) * s, v = (Math.random() - .5) * s;
      let x, y, z;
      if (face === 0) { x =  h; y = u; z = v; } else if (face === 1) { x = -h; y = u; z = v; }
      else if (face === 2) { x = u; y =  h; z = v; } else if (face === 3) { x = u; y = -h; z = v; }
      else if (face === 4) { x = u; y = v; z =  h; } else { x = u; y = v; z = -h; }
      a[i*3] = x; a[i*3+1] = y; a[i*3+2] = z;
    }
    return a;
  }

  function helix(n, R, H, turns) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / n, ang = t * Math.PI * 2 * turns;
      const jitter = (Math.random() - .5) * .55;
      a[i*3]   = Math.cos(ang) * (R + jitter);
      a[i*3+1] = (t - .5) * H + (Math.random() - .5) * .18;
      a[i*3+2] = Math.sin(ang) * (R + jitter);
    }
    return a;
  }

  function wavePlane(n, size) {
    const a = new Float32Array(n * 3), side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const gx = (i % side) / side - .5, gz = Math.floor(i / side) / side - .5;
      const x = gx * size, z = gz * size;
      a[i*3] = x; a[i*3+1] = Math.sin(x * .9) * Math.cos(z * .9) * .85; a[i*3+2] = z;
    }
    return a;
  }

  let renderer, scene, camera, points, ring, group, geo, uniforms;
  let shapes = [], target = 0, current = 0;
  let scrollP = 0, scrollTarget = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function initGL() {
    const canvas = document.getElementById('scene');
    if (!canvas || !hasTHREE) return false;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { return false; }

    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    scene  = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07070a, 0.055);
    camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    group = new THREE.Group();
    scene.add(group);

    shapes = [
      fibonacciSphere(COUNT, 2.75),
      torusKnot(COUNT, 3.1, 0.62, 2, 3),
      cubeShell(COUNT, 4.1),
      helix(COUNT, 2.0, 6.2, 6),
      wavePlane(COUNT, 8.5)
    ];

    geo = new THREE.BufferGeometry();
    const pos  = new Float32Array(shapes[0]);
    const rand = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) rand[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

    uniforms = {
      uTime: { value: 0 },
      uSize: { value: 62.0 },
      uPix:  { value: Math.min(devicePixelRatio, 2) },
      uC1:   { value: new THREE.Color(0x7c5cff) },
      uC2:   { value: new THREE.Color(0x00e2b8) },
      uC3:   { value: new THREE.Color(0xff5c8a) }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aRand;
        uniform float uTime, uSize, uPix;
        varying float vR;
        void main(){
          vec3 p = position;
          float w = uTime * 0.55 + aRand * 6.2831;
          p.x += sin(w) * 0.055;
          p.y += cos(w * 0.9) * 0.055;
          p.z += sin(w * 0.7) * 0.055;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uPix * (0.45 + aRand * 0.75) / max(-mv.z, 0.001);
          gl_Position = projectionMatrix * mv;
          vR = aRand;
        }`,
      fragmentShader: `
        uniform vec3 uC1, uC2, uC3;
        varying float vR;
        void main(){
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.08, d);
          vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.7, vR));
          c = mix(c, uC3, smoothstep(0.78, 1.0, vR));
          gl_FragColor = vec4(c, a * 0.92);
        }`
    });

    points = new THREE.Points(geo, mat);
    group.add(points);

    // anello wireframe di supporto
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.006, 3, 160),
      new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.28 })
    );
    ring.rotation.x = Math.PI * 0.42;
    group.add(ring);

    addEventListener('resize', onResize);
    return true;
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    uniforms.uPix.value = Math.min(devicePixelRatio, 2);
  }

  const clock = hasTHREE ? new THREE.Clock() : null;

  function morph(t) {
    const seg = shapes.length - 1;
    const f = Math.max(0, Math.min(0.9999, t)) * seg;
    const i = Math.floor(f);
    let k = f - i;
    k = k * k * (3 - 2 * k); // smoothstep
    const A = shapes[i], B = shapes[i + 1] || shapes[i];
    const arr = geo.attributes.position.array;
    for (let j = 0; j < arr.length; j++) arr[j] = A[j] + (B[j] - A[j]) * k;
    geo.attributes.position.needsUpdate = true;
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!renderer) return;

    const el = clock.getElapsedTime();
    uniforms.uTime.value = el;

    // scroll morbido
    const max = Math.max(1, document.body.scrollHeight - innerHeight);
    scrollTarget = scrollY / max;
    scrollP += (scrollTarget - scrollP) * 0.06;

    current += (scrollP - current) * 0.12;
    morph(current);

    // parallax mouse
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    group.rotation.y = el * 0.055 + mouse.x * 0.45 + scrollP * 1.6;
    group.rotation.x = mouse.y * 0.28 + Math.sin(el * 0.22) * 0.06;
    ring.rotation.z  = el * 0.12;

    camera.position.z = 8.2 - Math.sin(scrollP * Math.PI) * 1.5;
    camera.position.y = -scrollP * 0.6;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  });

  /* ==================================================
     2. UTILITY — split testo in parole
     ================================================== */
  function splitWords(el) {
    if (el.dataset.done) return [];
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="word"><i>${w}</i></span>`).join(' ');
    el.dataset.done = '1';
    return el.querySelectorAll('.word i');
  }

  /* ==================================================
     3. PRELOADER
     ================================================== */
  function runLoader(onDone) {
    const loader = document.getElementById('loader');
    const bar    = document.getElementById('loaderBar');
    const count  = document.getElementById('loaderCount');
    document.body.classList.add('is-loading');

    const finish = () => {
      document.body.classList.remove('is-loading');
      if (hasGSAP) {
        gsap.to(loader, {
          yPercent: -100, duration: 1.05, ease: 'expo.inOut',
          onComplete: () => { loader.style.display = 'none'; onDone(); }
        });
      } else { loader.style.display = 'none'; onDone(); }
    };

    if (!hasGSAP) { finish(); return; }

    const state = { v: 0 };
    gsap.to(state, {
      v: 100, duration: 1.9, ease: 'power2.inOut',
      onUpdate: () => {
        const n = Math.round(state.v);
        count.textContent = n;
        bar.style.width = n + '%';
      },
      onComplete: finish
    });
  }

  /* ==================================================
     4. ANIMAZIONI GSAP
     ================================================== */
  function heroIn() {
    if (!hasGSAP) return;
    const lines = document.querySelectorAll('.hero__title .line');
    lines.forEach(l => { if (!l.querySelector(':scope > span')) l.innerHTML = `<span>${l.innerHTML}</span>`; });

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.nav', { yPercent: -100, opacity: 0, duration: 1 }, 0)
      .to('.brandmark', { opacity: 1, duration: 1.1 }, .1)
      .from('.hero__eyebrow', { y: 20, opacity: 0, duration: .9 }, .15)
      .from('.hero__title .line > span', { yPercent: 110, duration: 1.35, stagger: .09 }, .2)
      .from('.hero__sub .word i', { yPercent: 110, opacity: 0, duration: .9, stagger: .012 }, .75)
      .from('.btn', { y: 24, opacity: 0, duration: .9 }, .95)
      .from('.hero__scroll', { opacity: 0, duration: .8 }, 1.15);
  }

  function scrollAnims() {
    if (!hasGSAP || typeof ScrollTrigger === 'undefined') {
      document.querySelectorAll('.reveal-up').forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; });
      return;
    }

    // testo split (esclusa hero, gestita nell'intro)
    document.querySelectorAll('[data-split]').forEach(el => {
      const inHero = el.closest('.hero');
      const targets = splitWords(el);
      if (inHero) return;
      gsap.from(targets, {
        scrollTrigger: { trigger: el, start: 'top 82%' },
        yPercent: 110, opacity: 0, duration: 1, ease: 'expo.out', stagger: .018
      });
    });

    // reveal generici
    gsap.utils.toArray('.reveal-up').forEach(el => {
      gsap.to(el, {
        scrollTrigger: { trigger: el, start: 'top 88%' },
        opacity: 1, y: 0, duration: 1.1, ease: 'expo.out'
      });
    });

    // sezioni
    document.querySelectorAll('.sec-head').forEach(el => {
      gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 90%' }, opacity: 0, y: 18, duration: .9, ease: 'expo.out' });
    });

    // card servizi
    gsap.from('.card', {
      scrollTrigger: { trigger: '.cards', start: 'top 78%' },
      y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .09
    });

    // studio items
    gsap.from('.studio__item', {
      scrollTrigger: { trigger: '.studio__grid', start: 'top 82%' },
      y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: .1
    });

    // lavori: i riquadri sbucano dal lato dello schermo, in sincrono con lo scroll
    gsap.utils.toArray('.work').forEach(w => {
      const visual = w.querySelector('.work__visual');
      const info   = w.querySelectorAll('.work__info > *');
      // il verso segue il layout: normale = arriva da sinistra, --reverse = da destra
      const dir = w.classList.contains('work--reverse') ? 1 : -1;
      const trigger = { trigger: w, start: 'top 92%', end: 'top 38%', scrub: 0.7 };

      gsap.fromTo(visual,
        { xPercent: dir * 140, rotate: dir * -5, scale: 0.92, opacity: 0 },
        { xPercent: 0, rotate: 0, scale: 1, opacity: 1, ease: 'none', scrollTrigger: trigger }
      );
      gsap.fromTo(info,
        { xPercent: dir * 40, opacity: 0 },
        { xPercent: 0, opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: trigger }
      );
    });

    // step processo
    gsap.utils.toArray('.step').forEach(s => {
      gsap.from(s, { scrollTrigger: { trigger: s, start: 'top 85%' }, y: 46, opacity: 0, duration: 1, ease: 'expo.out' });
    });

    // barra di avanzamento processo
    const bar = document.getElementById('procBar');
    if (bar) {
      gsap.to(bar, {
        scrollTrigger: { trigger: '.proc__steps', start: 'top 65%', end: 'bottom 75%', scrub: .6 },
        width: '100%', ease: 'none'
      });
    }

    // contatori
    document.querySelectorAll('[data-count]').forEach(el => {
      const end = +el.dataset.count;
      const o = { v: 0 };
      gsap.to(o, {
        scrollTrigger: { trigger: el, start: 'top 88%' },
        v: end, duration: 1.8, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(o.v); }
      });
    });

    // titolo CTA
    const cta = document.querySelectorAll('.cta__title .line');
    cta.forEach(l => { if (!l.querySelector(':scope > span')) l.innerHTML = `<span>${l.innerHTML}</span>`; });
    gsap.from('.cta__title .line > span', {
      scrollTrigger: { trigger: '.contatti', start: 'top 70%' },
      yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .1
    });
    gsap.from(['.cta__mail', '.cta__note'], {
      scrollTrigger: { trigger: '.contatti', start: 'top 62%' },
      y: 26, opacity: 0, duration: 1, ease: 'expo.out', stagger: .12
    });

    // nav compatta
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: self => document.getElementById('nav').classList.toggle('is-stuck', self.scroll() > 80)
    });
  }

  /* ==================================================
     5. MARQUEE infinito
     ================================================== */
  function marquee() {
    const track = document.getElementById('marqueeTrack');
    if (!track) return;
    const span = track.querySelector('span');
    for (let i = 0; i < 3; i++) track.appendChild(span.cloneNode(true));
    if (!hasGSAP) return;
    gsap.to(track, { xPercent: -25, duration: 26, ease: 'none', repeat: -1 });
  }

  /* ==================================================
     6. CURSORE CUSTOM
     ================================================== */
  function cursor() {
    const c = document.getElementById('cursor');
    const label = document.getElementById('cursorLabel');
    if (!c || matchMedia('(hover: none)').matches) return;

    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    let vx = 0, vy = 0;

    addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });

    (function loop() {
      const px = x, py = y;
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      vx = x - px; vy = y - py;

      // la goccia si allunga nella direzione del movimento e torna rotonda da ferma
      const speed = Math.min(Math.hypot(vx, vy), 26);
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);
      const stretch = 1 + speed / 22;
      const squeeze = 1 - speed / 60;

      c.style.transform =
        `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${angle}deg) scale(${stretch}, ${squeeze})`;
      requestAnimationFrame(loop);
    })();

    document.querySelectorAll('[data-hover]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const t = el.dataset.cursor;
        if (t) { label.textContent = t; c.classList.add('is-label'); }
        else c.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', () => c.classList.remove('is-hover', 'is-label'));
    });
  }

  /* ==================================================
     7. Gradiente che segue il mouse sulle card
     ================================================== */
  /* ==================================================
     7b. Logotipo liquido — distorsione SVG continua
     ================================================== */
  function liquidLogo() {
    const turb  = document.getElementById('liquidTurb');
    const disp  = document.getElementById('liquidDisplace');
    const grad  = document.getElementById('liquidGrad');
    if (!turb || !disp || reduced) return;

    if (!hasGSAP) return;

    // la scala di spostamento "respira" per dare l'idea di fluido che si muove
    gsap.to(disp, {
      attr: { scale: 30 }, duration: 3.4, ease: 'sine.inOut',
      yoyo: true, repeat: -1
    });

    // la frequenza del rumore varia lentamente: la forma della distorsione cambia nel tempo
    const freq = { v: 0.010 };
    gsap.to(freq, {
      v: 0.024, duration: 5.5, ease: 'sine.inOut', yoyo: true, repeat: -1,
      onUpdate: () => turb.setAttribute('baseFrequency', `${freq.v} ${freq.v * 3.3}`)
    });

    // il gradiente scorre sul testo come un liquido colorato
    if (grad) {
      gsap.to(grad, {
        attr: { x1: '100%', y1: '100%', x2: '0%', y2: '0%' },
        duration: 6.5, ease: 'sine.inOut', yoyo: true, repeat: -1
      });
    }
  }

  function cardGlow() {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ==================================================
     BOOT
     ================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    // prepara lo split della hero prima dell'intro
    document.querySelectorAll('.hero [data-split]').forEach(splitWords);

    cursor();
    cardGlow();
    marquee();
    liquidLogo();

    const glOK = !reduced && initGL();
    if (glOK) tick();

    runLoader(() => {
      heroIn();
      scrollAnims();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
  });

})();
