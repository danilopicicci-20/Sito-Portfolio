/* =============================================================================
   Fluids Studio — Danilo Picicci
   Three.js (nuvola di particelle che cambia forma) + GSAP / ScrollTrigger

   Struttura del file
     0. Setup e capability detection
     1. WebGL — la scena di sfondo
     2. Utility di testo
     3. Preloader
     4. Intro della hero
     5. Animazioni legate allo scroll
     6. Marquee
     7. Cursore custom
     8. Micro-interazioni (logo liquido, bagliore sulle card)
     9. Boot

   Due regole seguite ovunque qui dentro:
     · niente innerHTML — il testo entra nel DOM come testo, mai come markup.
       Oggi tutti i contenuti sono nostri e statici, ma il giorno in cui una
       stringa arrivasse da fuori (un CMS, un parametro URL) quel percorso
       sarebbe già una falla. Costa poco chiuderlo adesso.
     · ogni animazione ha una via d'uscita — se GSAP non carica o se l'utente
       ha chiesto meno movimento, il sito resta leggibile e completo.
   ============================================================================= */

(() => {
  'use strict';

  /* ===========================================================================
     0. SETUP
     =========================================================================== */

  // Al ricaricamento la pagina deve ripartire dall'inizio, non dalla posizione
  // di scroll che il browser tenta di ripristinare: l'intro presuppone di
  // partire da cima pagina.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  addEventListener('pageshow', () => scrollTo(0, 0));

  const hasGSAP  = typeof gsap !== 'undefined';
  const hasST    = hasGSAP && typeof ScrollTrigger !== 'undefined';
  const hasTHREE = typeof THREE !== 'undefined';
  const reduced  = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hasST) gsap.registerPlugin(ScrollTrigger);

  // Elementi che il CSS tiene invisibili in attesa dell'intro. Se l'intro non
  // può partire vanno rimessi a vista, altrimenti restano nascosti per sempre.
  const HIDDEN_UNTIL_INTRO = [
    '.nav',
    '.brandmark',
    '.hero__eyebrow',
    '.hero__title .line > span',
    '.hero__sub .word i',
    '.hero .btn',
    '.hero__scroll',
    '.reveal-up'
  ].join(', ');

  function revealStatic() {
    document.querySelectorAll(HIDDEN_UNTIL_INTRO).forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  /* ===========================================================================
     1. WEBGL — nuvola di particelle che cambia forma con lo scroll
     ===========================================================================
     Cinque nuvole di punti con lo stesso numero di vertici; lo scroll
     interpola linearmente da una all'altra. Tenere COUNT identico fra le
     forme è ciò che rende possibile il morphing senza ricostruire la
     geometria a ogni frame.
     =========================================================================== */

  const COUNT = 6500;

  function fibonacciSphere(n, R) {
    const a = new Float32Array(n * 3);
    const phi = Math.PI * (3 - Math.sqrt(5));   // angolo aureo
    for (let i = 0; i < n; i++) {
      const y  = 1 - (i / (n - 1)) * 2;
      const r  = Math.sqrt(Math.max(0, 1 - y * y));
      const th = phi * i;
      a[i * 3]     = Math.cos(th) * r * R;
      a[i * 3 + 1] = y * R;
      a[i * 3 + 2] = Math.sin(th) * r * R;
    }
    return a;
  }

  function torusKnot(n, R, r, p, q) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u  = (i / n) * Math.PI * 2 * p;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const qu = (q / p) * u;
      const cs = Math.cos(qu) + 2;
      // punto sparso dentro la sezione del tubo, non sulla sua superficie
      const tube = Math.random() * Math.PI * 2;
      const rad  = r * Math.sqrt(Math.random());
      a[i * 3]     = 0.5 * cs * cu * R + Math.cos(tube) * rad;
      a[i * 3 + 1] = 0.5 * cs * su * R + Math.sin(tube) * rad;
      a[i * 3 + 2] = 0.5 * Math.sin(qu) * R + (Math.random() - 0.5) * rad;
    }
    return a;
  }

  function cubeShell(n, s) {
    const a = new Float32Array(n * 3);
    const h = s / 2;
    for (let i = 0; i < n; i++) {
      const face = Math.floor(Math.random() * 6);
      const u = (Math.random() - 0.5) * s;
      const v = (Math.random() - 0.5) * s;
      let x, y, z;
      if      (face === 0) { x =  h; y =  u; z =  v; }
      else if (face === 1) { x = -h; y =  u; z =  v; }
      else if (face === 2) { x =  u; y =  h; z =  v; }
      else if (face === 3) { x =  u; y = -h; z =  v; }
      else if (face === 4) { x =  u; y =  v; z =  h; }
      else                 { x =  u; y =  v; z = -h; }
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    return a;
  }

  function helix(n, R, H, turns) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t   = i / n;
      const ang = t * Math.PI * 2 * turns;
      // il jitter evita che l'elica sembri un filo perfetto, poco naturale
      const jitter = (Math.random() - 0.5) * 0.55;
      a[i * 3]     = Math.cos(ang) * (R + jitter);
      a[i * 3 + 1] = (t - 0.5) * H + (Math.random() - 0.5) * 0.18;
      a[i * 3 + 2] = Math.sin(ang) * (R + jitter);
    }
    return a;
  }

  function wavePlane(n, size) {
    const a = new Float32Array(n * 3);
    const side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const gx = (i % side) / side - 0.5;
      const gz = Math.floor(i / side) / side - 0.5;
      const x = gx * size;
      const z = gz * size;
      a[i * 3]     = x;
      a[i * 3 + 1] = Math.sin(x * 0.9) * Math.cos(z * 0.9) * 0.85;
      a[i * 3 + 2] = z;
    }
    return a;
  }

  let renderer, scene, camera, ring, group, geo, uniforms;
  let shapes = [];
  let scrollP = 0;
  let docMax = 1;                       // altezza scrollabile, letta solo al resize
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let morphed = 0;                      // posizione attuale nel morphing, smorzata

  function measureDoc() {
    docMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  }

  function initGL() {
    const canvas = document.getElementById('scene');
    if (!canvas || !hasTHREE) return false;

    // Il contesto WebGL può mancare (driver bloccato, GPU esclusa, contesti
    // esauriti): in quel caso il sito deve semplicemente restare senza sfondo.
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
      });
    } catch (err) {
      return false;
    }

    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));   // oltre 2× non si vede la differenza, si paga solo

    scene = new THREE.Scene();
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
      depthWrite: false,                       // i punti si sommano, non si occludono
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aRand;
        uniform float uTime, uSize, uPix;
        varying float vR;
        void main(){
          vec3 p = position;
          // ogni punto oscilla con una fase propria: il gruppo "respira"
          float w = uTime * 0.55 + aRand * 6.2831;
          p.x += sin(w) * 0.055;
          p.y += cos(w * 0.9) * 0.055;
          p.z += sin(w * 0.7) * 0.055;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // dimensione prospettica: più lontano, più piccolo
          gl_PointSize = uSize * uPix * (0.45 + aRand * 0.75) / max(-mv.z, 0.001);
          gl_Position = projectionMatrix * mv;
          vR = aRand;
        }`,
      fragmentShader: `
        uniform vec3 uC1, uC2, uC3;
        varying float vR;
        void main(){
          // ritaglia il quadrato del punto in un cerchio sfumato
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.08, d);
          vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.7, vR));
          c = mix(c, uC3, smoothstep(0.78, 1.0, vR));   // solo una minoranza vira al rosa
          gl_FragColor = vec4(c, a * 0.92);
        }`
    });

    group.add(new THREE.Points(geo, mat));

    // anello wireframe di supporto: dà un riferimento di profondità alla nuvola
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.006, 3, 160),
      new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.28 })
    );
    ring.rotation.x = Math.PI * 0.42;
    group.add(ring);

    measureDoc();
    addEventListener('resize', onResize, { passive: true });
    return true;
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    uniforms.uPix.value = Math.min(devicePixelRatio, 2);
    measureDoc();
  }

  const clock = hasTHREE ? new THREE.Clock() : null;

  /* Interpola fra le forme. `t` 0..1 copre l'intera sequenza. */
  function morph(t) {
    const segments = shapes.length - 1;
    const f = Math.max(0, Math.min(0.9999, t)) * segments;
    const i = Math.floor(f);
    let k = f - i;
    k = k * k * (3 - 2 * k);                 // smoothstep: entra ed esce morbido
    const A = shapes[i];
    const B = shapes[i + 1] || shapes[i];
    const arr = geo.attributes.position.array;
    for (let j = 0; j < arr.length; j++) arr[j] = A[j] + (B[j] - A[j]) * k;
    geo.attributes.position.needsUpdate = true;
  }

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (!renderer) return;

    const el = clock.getElapsedTime();
    uniforms.uTime.value = el;

    // Lo scroll grezzo è a scatti: due smorzamenti in cascata (uno sulla
    // posizione, uno sul morphing) lo trasformano in un movimento continuo.
    scrollP += (scrollY / docMax - scrollP) * 0.06;
    morphed += (scrollP - morphed) * 0.12;
    morph(morphed);

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    group.rotation.y = el * 0.055 + mouse.x * 0.45 + scrollP * 1.6;
    group.rotation.x = mouse.y * 0.28 + Math.sin(el * 0.22) * 0.06;
    ring.rotation.z  = el * 0.12;

    // la camera si avvicina a metà pagina e poi si allontana: dà respiro
    camera.position.z = 8.2 - Math.sin(scrollP * Math.PI) * 1.5;
    camera.position.y = -scrollP * 0.6;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  /* ===========================================================================
     2. UTILITY DI TESTO
     ===========================================================================
     Entrambe le funzioni ricostruiscono il DOM con createElement/textContent
     invece che con innerHTML: il testo resta testo e non può mai essere
     reinterpretato come markup.
     =========================================================================== */

  /* Spezza un paragrafo in parole animabili una per una.
     Struttura: <span class="word"><i>parola</i></span>
     Il wrapper esterno ha overflow nascosto, la <i> è ciò che scorre. */
  function splitWords(el) {
    if (el.dataset.split === 'done') return [];

    const words = el.textContent.trim().split(/\s+/);
    const frag = document.createDocumentFragment();

    words.forEach((w, i) => {
      if (i) frag.appendChild(document.createTextNode(' '));
      const outer = document.createElement('span');
      outer.className = 'word';
      const inner = document.createElement('i');
      inner.textContent = w;
      outer.appendChild(inner);
      frag.appendChild(outer);
    });

    el.textContent = '';
    el.appendChild(frag);
    el.dataset.split = 'done';
    return el.querySelectorAll('.word i');
  }

  /* Avvolge il contenuto di una riga di titolo in uno <span> traslabile.
     I nodi esistenti vengono SPOSTATI dentro il wrapper, non riletti come
     stringa: così l'<em> interno sopravvive intatto. */
  function wrapLine(el) {
    if (el.children.length === 1 && el.firstElementChild.tagName === 'SPAN') return;
    const span = document.createElement('span');
    while (el.firstChild) span.appendChild(el.firstChild);
    el.appendChild(span);
  }

  /* ===========================================================================
     3. PRELOADER
     ===========================================================================
     Tre fasi, tutte sullo stesso tema "fluido":
       1. nasce un puntino e la linea del logo ESCE da lui mentre corre;
          poi l'anello si chiude attorno al segno
       2. il wordmark si riempie di liquido attraverso una mask SVG
       3. la tenda risale con un bordo ondulato

     Le due superfici liquide (fasi 2 e 3) non sono keyframe: il path viene
     RIGENERATO a ogni frame da una somma di sinusoidi, così il profilo non
     si ripete mai identico. Costo: due setAttribute per frame.
     =========================================================================== */

  /* Superficie liquida che sale. `level` 0 = vuoto, 1 = pieno.
     Le due sinusoidi hanno periodi non multipli l'uno dell'altro: il profilo
     sembra irregolare pur restando deterministico. */
  function liquidRise(level, phase, W, H, amp) {
    const N = 40;
    const base = H + amp - level * (H + amp * 2);
    let d = '';
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = W * u;
      const y = base
        + amp * Math.sin(u * Math.PI * 3.1 + phase)
        + amp * 0.42 * Math.sin(u * Math.PI * 5.7 - phase * 1.45);
      d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(2);
    }
    const floor = (H + amp + 6).toFixed(1);
    return `${d} L${W} ${floor} L0 ${floor} Z`;
  }

  /* Tenda: stessa idea, ma la superficie separa il pieno (sopra) dal vuoto
     (sotto) e sale fuori schermo. `p` 0 = copre tutto, 1 = uscita completata. */
  function curtainRise(p, phase, amp) {
    const N = 34;
    const base = 100 + amp - p * (120 + amp * 2);
    let d = '';
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = 100 * u;
      const y = base
        + amp * Math.sin(u * Math.PI * 2.4 + phase)
        + amp * 0.40 * Math.sin(u * Math.PI * 4.6 - phase * 1.3);
      d += (i ? ' L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return `${d} L100 -25 L0 -25 Z`;
  }

  function runLoader(onDone) {
    const loader = document.getElementById('loader');
    if (!loader) { onDone(); return; }

    document.body.classList.add('is-loading');

    const release = () => {
      document.body.classList.remove('is-loading');
      onDone();
    };
    const hide = () => { loader.style.display = 'none'; };

    // Senza GSAP, o se l'utente ha chiesto meno movimento, si salta tutto:
    // la pagina compare già completa.
    if (!hasGSAP || reduced) { release(); hide(); return; }

    const fillEl  = document.getElementById('loaderFill');
    const curtEl  = document.getElementById('loaderCurtain');
    const waveEl  = document.getElementById('loaderWave');
    const dropPos = document.getElementById('loaderDropPos');
    const dropPop = document.getElementById('loaderDropPop');
    const dropEl  = document.getElementById('loaderDrop');
    const pingEl  = document.getElementById('loaderPing');

    // Se il markup del loader fosse incompleto, meglio non partire affatto
    // che restare bloccati su un pannello nero.
    if (!fillEl || !curtEl || !waveEl || !dropPos || !dropPop || !dropEl || !pingEl) {
      release(); hide(); return;
    }

    const waveLen = waveEl.getTotalLength();

    /* Piazza la goccia al punto `u` (0..1) del tracciato, orientata e stirata
       nella direzione di marcia: più corre, più si allunga e si assottiglia.
       È lo stesso principio del cursore liquido del sito. */
    let lastU = 0;
    let lastT = 0;

    function placeDrop(u, stretch) {
      const L = u * waveLen;
      const a = waveEl.getPointAtLength(L);
      const b = waveEl.getPointAtLength(Math.min(waveLen, L + 1.5));   // punto poco più avanti: dà la tangente
      const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      dropPos.setAttribute('transform', `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)})`);
      dropEl.setAttribute(
        'transform',
        `rotate(${ang.toFixed(1)}) scale(${(1 + stretch * 0.85).toFixed(3)} ${(1 - stretch * 0.34).toFixed(3)})`
      );
    }
    placeDrop(0, 0);

    // Stato letto dal ticker: GSAP interpola i numeri, il ticker ridisegna i path.
    const liq = { level: 0 };
    const cur = { p: 0 };

    const paint = () => {
      const t = performance.now() / 1000;
      fillEl.setAttribute('d', liquidRise(liq.level, t * 2.5, 420, 40, 3.2));
      // l'onda della tenda cresce e poi si ricompone: massima a metà corsa
      const amp = 7.5 * Math.sin(Math.min(1, Math.max(0, cur.p)) * Math.PI);
      curtEl.setAttribute('d', curtainRise(cur.p, t * 2.1, amp));
    };
    paint();
    gsap.ticker.add(paint);

    const tl = gsap.timeline({
      paused: true,                                       // si parte a font pronti, vedi in fondo
      onComplete: () => { gsap.ticker.remove(paint); hide(); }
    });

    /* --- FASE 1a · il puntino nasce, da solo, sul nulla --- */
    tl.set(dropPos, { opacity: 1 }, 0)
      .fromTo(dropPop,
        { scale: 0 },
        { scale: 1, duration: 0.42, ease: 'back.out(2.8)' }, 0)
      // increspatura: un anello che si allarga e svanisce, come un tuffo
      .fromTo(pingEl,
        { scale: 0.55, opacity: 0.85 },
        { scale: 4.2, opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.08)

    /* --- FASE 1b · la linea esce dal puntino ---
       Il tratto e la corsa condividono start, durata ed easing: il tratto
       finisce esattamente sotto la goccia, fotogramma per fotogramma. */
      .fromTo('#loaderWave',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' }, 0.4)
      .to({ u: 0 }, {
        u: 1, duration: 1, ease: 'power2.inOut',
        onStart() { lastU = 0; lastT = performance.now(); },
        onUpdate() {
          const u = this.targets()[0].u;
          const now = performance.now();
          const dt = Math.max(8, now - lastT) / 1000;     // clamp: evita divisioni per ~0
          const speed = Math.abs(u - lastU) / dt;         // frazione di tracciato al secondo
          lastU = u;
          lastT = now;
          placeDrop(u, Math.min(1, speed / 2.2));
        },
        onComplete() { placeDrop(1, 0); }
      }, 0.4)
      // l'eco dell'onda insegue con un po' di ritardo
      .fromTo('#loaderWave2',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 0.95, ease: 'power2.inOut' }, 0.62)
      // arrivo: la goccia si schiaccia contro il traguardo e manda un'onda
      .to(dropPop, { scale: 1.45, duration: 0.16, ease: 'power2.out' }, 1.4)
      .to(dropPop, { scale: 1, duration: 0.3, ease: 'power2.inOut' }, 1.56)
      .fromTo(pingEl,
        { scale: 0.55, opacity: 0.8 },
        { scale: 4, opacity: 0, duration: 0.75, ease: 'power2.out' }, 1.4)

    /* --- FASE 1c · l'anello si chiude attorno al segno --- */
      .fromTo('#loaderRing',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.05, ease: 'power2.inOut' }, 1.35)
      .to('#loaderRingBg', { opacity: 1, duration: 0.5 }, 1.45)

    /* --- FASE 2 · il wordmark si riempie --- */
      .to('.loader__word', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.55)
      .to(liq, { level: 1, duration: 1.1, ease: 'power2.inOut' }, 1.75)

    /* --- FASE 3 · respiro e uscita a tenda --- */
      .to('.loader__mark', { scale: 1.05, duration: 0.26, ease: 'power2.out' }, 2.9)
      .to('.loader__mark', { scale: 1, duration: 0.34, ease: 'power2.inOut' }, 3.16)
      // Da qui la copertura è solo il path: senza questo, il fondo pieno del
      // pannello resterebbe visibile sotto la tenda che sale.
      .call(() => { loader.style.background = 'transparent'; }, null, 3.2)
      // La hero parte mentre la tenda risale, così si scopre già in movimento.
      .call(release, null, 3.23)
      .to('.loader__inner', { y: -80, opacity: 0, duration: 0.65, ease: 'power2.in' }, 3.2)
      .to(cur, { p: 1, duration: 1, ease: 'power2.inOut' }, 3.25);

    // ~4,25 s a velocità 1: troppo. 1,5× lo porta a ~2,8 s.
    // Chi ha già visto l'intro in questa sessione se la becca in ~1,2 s.
    // sessionStorage può lanciare (Safari in navigazione privata, cookie
    // bloccati di terze parti in iframe): in quel caso si mostra l'intro piena.
    let seen = false;
    try {
      seen = sessionStorage.getItem('fs_intro') === '1';
      sessionStorage.setItem('fs_intro', '1');
    } catch (err) { /* storage non disponibile: nessun problema */ }
    tl.timeScale(seen ? 3.4 : 1.5);

    // Il wordmark è testo SVG: con un font di sistema al posto di Inter Tight
    // le spaziature sarebbero tutte sbagliate. Si attende document.fonts,
    // ma non oltre 700 ms — meglio un wordmark imperfetto di un sito fermo.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      tl.play();
    };
    setTimeout(start, 700);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  }

  /* ===========================================================================
     4. INTRO DELLA HERO
     ===========================================================================
     fromTo() ovunque: GSAP imposta sia partenza sia arrivo, quindi le unità
     restano coerenti e non si mescolano percentuali CSS e yPercent. Il CSS
     tiene gli elementi a opacità 0 finché non parte questa timeline, così non
     c'è mai un fotogramma in cui il testo lampeggia fuori posto.
     =========================================================================== */

  function heroIn() {
    if (!hasGSAP || reduced) { revealStatic(); return; }

    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo('.nav',
        { yPercent: -100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.7 }, 0)
      .to('.brandmark', { opacity: 1, duration: 0.7 }, 0.05)
      .fromTo('.hero__eyebrow',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 }, 0.1)
      .fromTo('.hero__title .line > span',
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.07 }, 0.15)
      .fromTo('.hero__sub .word i',
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.6, stagger: 0.01 }, 0.45)
      .fromTo('.hero .btn',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 }, 0.6)
      .fromTo('.hero__scroll',
        { opacity: 0 },
        { opacity: 1, duration: 0.5 }, 0.75);
  }

  /* ===========================================================================
     5. ANIMAZIONI LEGATE ALLO SCROLL
     =========================================================================== */

  function scrollAnims() {
    // Senza ScrollTrigger (o con reduced motion) i contenuti devono comunque
    // esserci tutti: si spezzano i testi e si rende visibile ogni cosa.
    if (!hasST || reduced) {
      document.querySelectorAll('[data-split]').forEach(splitWords);
      document.querySelectorAll('.cta__title .line').forEach(wrapLine);
      revealStatic();
      return;
    }

    // Testo parola per parola (la hero è già gestita nell'intro).
    document.querySelectorAll('[data-split]').forEach(el => {
      const targets = splitWords(el);
      if (el.closest('.hero')) return;
      gsap.from(targets, {
        scrollTrigger: { trigger: el, start: 'top 82%' },
        yPercent: 110, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.018
      });
    });

    // Reveal generici.
    gsap.utils.toArray('.reveal-up').forEach(el => {
      gsap.to(el, {
        scrollTrigger: { trigger: el, start: 'top 88%' },
        opacity: 1, y: 0, duration: 1.1, ease: 'expo.out'
      });
    });

    // Intestazioni di sezione.
    document.querySelectorAll('.sec-head').forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 90%' },
        opacity: 0, y: 18, duration: 0.9, ease: 'expo.out'
      });
    });

    // Card servizi.
    gsap.from('.card', {
      scrollTrigger: { trigger: '.cards', start: 'top 78%' },
      y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09
    });

    // Blocchi "Approccio".
    // fromTo() con stato finale esplicito: un from() registrerebbe come
    // "arrivo" il valore corrente, e se un altro tween avesse lasciato lì
    // un'opacità 0 i blocchi comparirebbero per poi sparire di nuovo.
    gsap.fromTo('.studio__item',
      { y: 40, opacity: 0 },
      {
        scrollTrigger: { trigger: '.studio__grid', start: 'top 82%' },
        y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.1,
        overwrite: 'auto'
      });

    // Lavori: i riquadri entrano dal lato dello schermo in sincrono con lo
    // scroll (scrub), non con una durata propria.
    gsap.utils.toArray('.work').forEach(w => {
      const visual = w.querySelector('.work__visual');
      const info   = w.querySelectorAll('.work__info > *');
      // il verso segue il layout: normale = arriva da sinistra, --reverse = da destra
      const dir = w.classList.contains('work--reverse') ? 1 : -1;
      const trigger = { trigger: w, start: 'top 92%', end: 'top 38%', scrub: 0.7 };

      gsap.fromTo(visual,
        { xPercent: dir * 140, rotate: dir * -5, scale: 0.92, opacity: 0 },
        { xPercent: 0, rotate: 0, scale: 1, opacity: 1, ease: 'none', scrollTrigger: trigger });

      gsap.fromTo(info,
        { xPercent: dir * 40, opacity: 0 },
        { xPercent: 0, opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: trigger });
    });

    // Passi del processo.
    gsap.utils.toArray('.step').forEach(s => {
      gsap.from(s, {
        scrollTrigger: { trigger: s, start: 'top 85%' },
        y: 46, opacity: 0, duration: 1, ease: 'expo.out'
      });
    });

    // Barra di avanzamento del processo.
    const bar = document.getElementById('procBar');
    if (bar) {
      gsap.to(bar, {
        scrollTrigger: { trigger: '.proc__steps', start: 'top 65%', end: 'bottom 75%', scrub: 0.6 },
        width: '100%', ease: 'none'
      });
    }

    // Contatori.
    document.querySelectorAll('[data-count]').forEach(el => {
      const end = Number(el.dataset.count);
      if (!Number.isFinite(end)) return;
      const o = { v: 0 };
      gsap.to(o, {
        scrollTrigger: { trigger: el, start: 'top 88%' },
        v: end, duration: 1.8, ease: 'power2.out',
        onUpdate: () => { el.textContent = String(Math.round(o.v)); }
      });
    });

    // Titolo della CTA finale.
    document.querySelectorAll('.cta__title .line').forEach(wrapLine);
    gsap.from('.cta__title .line > span', {
      scrollTrigger: { trigger: '.contatti', start: 'top 70%' },
      yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1
    });
    gsap.from(['.cta__mail', '.cta__note'], {
      scrollTrigger: { trigger: '.contatti', start: 'top 62%' },
      y: 26, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12
    });

    // Nav compatta dopo i primi 80px. Il nodo è preso una volta sola: dentro
    // onUpdate sarebbe una query a ogni frame di scroll.
    const nav = document.getElementById('nav');
    if (nav) {
      ScrollTrigger.create({
        start: 'top -80',
        onUpdate: self => nav.classList.toggle('is-stuck', self.scroll() > 80)
      });
    }
  }

  /* ===========================================================================
     6. MARQUEE INFINITO
     ===========================================================================
     Il nastro viene clonato 3 volte e traslato del 25%: quando la prima copia
     è uscita, la seconda si trova esattamente dov'era la prima. Il ciclo si
     chiude senza salti.
     =========================================================================== */

  function marquee() {
    const track = document.getElementById('marqueeTrack');
    if (!track) return;

    const span = track.querySelector('span');
    if (!span) return;
    for (let i = 0; i < 3; i++) track.appendChild(span.cloneNode(true));

    if (!hasGSAP || reduced) return;
    gsap.to(track, { xPercent: -25, duration: 26, ease: 'none', repeat: -1 });
  }

  /* ===========================================================================
     7. CURSORE CUSTOM
     ===========================================================================
     Una goccia che insegue il puntatore con ritardo e si deforma in base alla
     velocità. Attivo solo dove esiste un puntatore fine: su touch il CSS
     ripristina il cursore di sistema.
     =========================================================================== */

  function cursor() {
    const c = document.getElementById('cursor');
    const label = document.getElementById('cursorLabel');
    if (!c || !label || matchMedia('(hover: none)').matches) return;

    let x = innerWidth / 2, y = innerHeight / 2;
    let tx = x, ty = y;

    addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });

    (function loop() {
      const px = x, py = y;
      x += (tx - x) * 0.22;                    // inseguimento smorzato
      y += (ty - y) * 0.22;
      const vx = x - px, vy = y - py;

      // si allunga nella direzione del movimento e torna rotonda da ferma
      const speed   = Math.min(Math.hypot(vx, vy), 26);
      const angle   = Math.atan2(vy, vx) * (180 / Math.PI);
      const stretch = 1 + speed / 22;
      const squeeze = 1 - speed / 60;

      c.style.transform =
        `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${angle}deg) scale(${stretch}, ${squeeze})`;

      requestAnimationFrame(loop);
    })();

    document.querySelectorAll('[data-hover]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const t = el.dataset.cursor;
        if (t) {
          label.textContent = t;
          c.classList.add('is-label');
        } else {
          c.classList.add('is-hover');
        }
      });
      el.addEventListener('mouseleave', () => c.classList.remove('is-hover', 'is-label'));
    });
  }

  /* ===========================================================================
     8. MICRO-INTERAZIONI
     =========================================================================== */

  /* Logotipo liquido della hero: il filtro SVG (feTurbulence + feDisplacementMap)
     viene fatto "respirare" animandone gli attributi. È la distorsione a
     muoversi, non il tracciato: il disegno resta sempre quello. */
  function liquidLogo() {
    const turb = document.getElementById('liquidTurb');
    const disp = document.getElementById('liquidDisplace');
    if (!turb || !disp || !hasGSAP || reduced) return;

    // quanto il rumore sposta i pixel: l'ampiezza del "flusso"
    gsap.to(disp, {
      attr: { scale: 30 }, duration: 3.4, ease: 'sine.inOut',
      yoyo: true, repeat: -1
    });

    // la frequenza del rumore varia lentamente: cambia la forma della
    // distorsione, non solo la sua intensità
    const freq = { v: 0.010 };
    gsap.to(freq, {
      v: 0.024, duration: 5.5, ease: 'sine.inOut', yoyo: true, repeat: -1,
      onUpdate: () => turb.setAttribute('baseFrequency', `${freq.v} ${freq.v * 3.3}`)
    });
  }

  /* Bagliore che segue il mouse dentro le card: il CSS legge --mx/--my. */
  function cardGlow() {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      }, { passive: true });
    });
  }

  /* ===========================================================================
     9. BOOT
     =========================================================================== */

  function boot() {
    // I wrapper di testo dell'intro vanno preparati PRIMA che il preloader
    // sparisca: così il CSS può tenerli nascosti fin dal primo fotogramma e
    // non c'è mai un istante in cui si vede il testo grezzo fuori posizione.
    document.querySelectorAll('.hero [data-split]').forEach(splitWords);
    document.querySelectorAll('.hero__title .line').forEach(wrapLine);

    // Rete di sicurezza: se GSAP non è disponibile il CSS lascerebbe questi
    // elementi invisibili per sempre.
    if (!hasGSAP) revealStatic();

    cursor();
    cardGlow();
    marquee();
    liquidLogo();

    if (!reduced && initGL()) renderLoop();

    runLoader(() => {
      heroIn();
      scrollAnims();
      // Le misure di ScrollTrigger sono state prese mentre il preloader
      // copriva la pagina: vanno rifatte ora che il layout è quello vero.
      if (hasST) ScrollTrigger.refresh();
      measureDoc();
    });
  }

  // Gli script sono caricati con `defer`, quindi girano a DOM completo ma
  // prima di DOMContentLoaded. Il controllo su readyState copre comunque il
  // caso in cui il file venisse incluso diversamente in futuro.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

})();
