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

  const hasGSAP = typeof gsap !== 'undefined';
  const hasST   = hasGSAP && typeof ScrollTrigger !== 'undefined';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Three.js non è nell'HTML: arriva dopo, se e quando serve (sezione 9).
  const hasTHREE = () => typeof THREE !== 'undefined';

  if (hasST) {
    gsap.registerPlugin(ScrollTrigger);
    // Su telefono la comparsa/scomparsa della barra degli indirizzi conta come
    // resize: senza questo, ogni scroll un po' deciso rimisurerebbe tutto.
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

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

  // Solo la hero, senza i .reveal-up che devono comparire scorrendo.
  // Serve quando c'è l'intro: lì la hero non "entra" con la sua animazione,
  // perché è già entrata dentro al filmato. Deve trovarsi composta e ferma,
  // identica all'ultimo fotogramma, nell'istante del raccordo.
  const HERO_COMPOSED = [
    '.nav',
    '.brandmark',
    '.hero__eyebrow',
    '.hero__title .line > span',
    '.hero__sub .word i',
    '.hero__scroll'
  ].join(', ');

  function composeHero() {
    document.querySelectorAll(HERO_COMPOSED).forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  /* --- L'intro va decisa adesso, non dopo: aggiungere .has-intro cambia
         l'altezza della hero, e deve succedere mentre il preloader copre
         ancora tutto. Se una qualsiasi condizione non è soddisfatta, la
         classe non viene messa e il sito resta esattamente quello di prima. */
  const introEl    = document.getElementById('intro');
  const introVideo = document.getElementById('introVideo');
  const netInfo    = navigator.connection;

  /* --- I due filmati d'intro, e le misure prese sul loro ultimo fotogramma ---

     Sono entrambi 1280×720, ma inquadrano cose diverse. Quello del laptop
     mostra la pagina a tutto schermo. Quello del telefono la mostra dentro il
     display, in una finestra verticale al centro del fotogramma — e non è un
     ostacolo, è un colpo di fortuna: object-fit:cover su uno schermo verticale
     ritaglia esattamente quella finestra (su 390×844 il ritaglio cade fra i
     pixel 473 e 806, cioè proprio i bordi del display), quindi lo schermo del
     telefono nel filmato finisce sovrapposto al viewport reale quasi da solo.

     Tutte le coordinate sono in pixel del video. Sono state misurate sul
     fotogramma finale, non stimate. */

  /* Cache-busting per i filmati — bump da fare ogni volta che uno dei tre
     file viene sostituito TENENDO LO STESSO NOME.
     I video hanno cache "immutable" di un anno (giusto: di norma non
     cambiano mai, ed è un file pesante che vale la pena non riscaricare a
     ogni visita). Ma il giorno in cui il contenuto cambia restando sotto lo
     stesso nome file, quella stessa cache "immutable" diventa il problema:
     un browser — o la cache del server, indipendentemente da quella del
     browser — può continuare a servire il video vecchio per un anno intero
     senza mai richiederlo di nuovo. È lo stesso bug della cache di main.js
     scoperto su Safari, spostato sui video. */
  const VIDEO_V = '20260830a';

  const REF = {
    laptop: {
      src:     'assets/video/intro-desktop.mp4?v=' + VIDEO_V,
      titleTL: [  60, 283],   // angoli del blocco titolo
      titleBR: [1220, 572],
      ruleL:   [  60, 615],   // estremi del filetto sopra il sottotitolo
      ruleR:   [1220, 615],
      mark:    [ 71.5, 71.5], // centro del logo nella nav
      topBand: 118,           // sotto questa quota inizia il brandmark
      vEnd:    0.88           // qui il filmato è all'ultimo fotogramma
    },
    telefono: {
      src:     'assets/video/intro-phone.mp4?v=' + VIDEO_V,
      // titleBR corretto: la misura precedente (780) aveva preso per errore
      // la larghezza del filetto sottostante invece di quella del titolo —
      // il titolo vero è largo quanto la riga "siti web che", non quanto il
      // filetto, che si estende oltre. Verificato riga per riga sul nuovo
      // fotogramma finale, identico a quello del video precedente.
      /* Bordi del DISPLAY nel fotogramma finale, misurati sul profilo di
         luminosità colonna per colonna: fuori dal vetro si sta sotto 4,
         dentro si salta a 7,5. Lo schermo va da x 473,5 a x 805,5 — quindi
         largo 332, centrato a 639,5 su un fotogramma largo 1280 (mezzo pixel
         dal centro esatto). Verticalmente riempie tutto il fotogramma.
         Sono QUESTI i riferimenti che contano per l'inquadratura. */
      screenCX: 639.5,
      screenHW: 166,
      // le ancore del testo restano documentate ma non guidano più il quadro
      titleTL: [ 500, 216],
      titleBR: [ 683, 396],
      ruleL:   [ 499, 464],
      ruleR:   [ 780, 464],
      mark:    [509.0, 58.5],
      topBand: 96,
      vEnd:    0.93            // qui il nuovo filmato si è già fermato
    }
  };

  /* Quale filmato mostrare.

     Un solo segnale non basta: Chrome e Safari sullo stesso iPhone hanno
     mostrato risultati diversi proprio perché ognuno guardava un solo dato,
     e quel dato può differire fra i due browser anche sullo stesso telefono
     (un'impostazione per-sito come "Richiedi sito desktop" cambia solo ciò
     che la PAGINA dichiara — innerWidth, innerHeight — non il dispositivo).
     Qui si incrociano tre segnali indipendenti, e ne basta uno solido:

     1. lo user-agent dice esplicitamente "telefono". Sia Safari sia Chrome su
        iOS montano lo stesso motore e dichiarano entrambi "iPhone" in UA:
        è il segnale che NON cambia mai fra i due browser, qualunque altra
        impostazione sia attiva.
     2. lo schermo FISICO (screen.width/height) è più alto che largo. A
        differenza di innerWidth/innerHeight — il viewport della PAGINA, che
        "Richiedi sito desktop" può alterare — screen descrive l'hardware e
        resta quello che è indipendentemente da come la pagina viene chiesta.
     3. il dito al posto del mouse (niente hover, puntatore grosso), come
        riserva per i casi in cui lo user-agent non aiuta.

     Un iPad va escluso esplicitamente: da iPadOS 13 si presenta come
     "Macintosh" ma resta touch, quindi il solo controllo touch+verticale lo
     scambierebbe per un telefono. */
  const ua = navigator.userAgent || '';
  const uaIsPhone   = /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
  const uaIsTablet  = /iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const isIpadOS    = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  const isTouch = matchMedia('(hover: none)').matches ||
                  matchMedia('(pointer: coarse)').matches ||
                  (navigator.maxTouchPoints || 0) > 0;

  // Schermo fisico: immune a zoom di pagina e a "richiedi sito desktop".
  const physW = (screen && screen.width)  || innerWidth;
  const physH = (screen && screen.height) || innerHeight;
  const isPortraitPhysical = physH >= physW;

  const usePhone = !uaIsTablet && !isIpadOS && isPortraitPhysical &&
                   (uaIsPhone || (isTouch && physW <= 500));

  /* `layout` dice a quale impaginazione del CSS appartiene questo filmato.
     Serve a computeMatch: il raccordo al pixel ha senso solo se la pagina
     sotto è impaginata come quella ripresa nel video. Se le due cose non
     coincidono si rinuncia all'allineamento e si allunga lo scambio. */
  const ref =
      usePhone          ? Object.assign({ layout: 'telefono' }, REF.telefono)
    : innerWidth <  900 ? Object.assign({ layout: 'laptop' }, REF.laptop,
                                        { src: 'assets/video/intro-mobile.mp4?v=' + VIDEO_V })
    :                     Object.assign({ layout: 'laptop' }, REF.laptop);

  /* Su un dispositivo con poca memoria l'intro chiederebbe di decodificare un
     video mentre gira una scena WebGL: meglio non proporla affatto che
     proporla a scatti. Stessa logica del risparmio dati. */
  const introOn = !!(introEl && introVideo) && hasST && !reduced
                  && !(netInfo && netInfo.saveData)
                  && !(navigator.deviceMemory && navigator.deviceMemory < 4)
                  && !!introVideo.canPlayType('video/mp4; codecs="avc1.4d401f"');

  if (introOn) {
    document.documentElement.classList.add('has-intro');
    // Il file scelto qui, e non con più <source>: così il telefono scarica
    // solo il filmato del telefono e il desktop solo quello del laptop.
    introVideo.src = ref.src;
    introVideo.load();
    primeVideo(introVideo);
  }

  /* Sblocco del buffer — è questo il punto in cui iOS si comporta come nessun
     altro, ed è il motivo per cui l'intro poteva non partire affatto su
     iPhone mentre funzionava ovunque.

     Safari su iOS non scarica i dati di un video finché la riproduzione non è
     partita almeno una volta: preload="auto" lì vale in pratica "metadata", e
     readyState si ferma a 1. Uno scrubbing che aspetta di avere i fotogrammi
     prima di cercare non parte mai, la rete di sicurezza scatta e l'intro
     sparisce — cioè esattamente "il sito di sempre".

     Un play() seguito immediatamente da pause() risolve: è permesso senza un
     gesto dell'utente proprio perché il video è muted e playsinline, non si
     vede muovere nulla, e da quel momento il buffer si riempie. Se il browser
     lo rifiuta comunque, si riprova al primo tocco. */
  function primeVideo(v) {
    const kick = () => {
      try {
        const p = v.play();
        if (p && typeof p.then === 'function') p.then(() => v.pause()).catch(() => {});
        else v.pause();
      } catch (err) { /* riproveremo al primo tocco */ }
    };
    kick();
    addEventListener('touchstart',  kick, { once: true, passive: true });
    addEventListener('pointerdown', kick, { once: true, passive: true });
  }

  // Pixel di scroll consumati dall'intro. Tutto ciò che ragiona in "quanto
  // sono sceso nella pagina" (sfondo 3D, nav compatta) deve sottrarli,
  // altrimenti al termine del filmato il sito si troverebbe già a metà delle
  // proprie animazioni invece che al proprio inizio.
  let scrollBase = 0;

  /* ===========================================================================
     1. WEBGL — nuvola di particelle che cambia forma con lo scroll
     ===========================================================================
     Cinque nuvole di punti con lo stesso numero di vertici; lo scroll
     interpola linearmente da una all'altra. Tenere COUNT identico fra le
     forme è ciò che rende possibile il morphing senza ricostruire la
     geometria a ogni frame.
     =========================================================================== */

  // Su schermo piccolo si scende a meno della metà delle particelle: la
  // differenza visiva è minima (lo sfondo è sfocato dallo scrim), quella sul
  // consumo di CPU e batteria no. Google misura i Core Web Vitals soprattutto
  // da mobile, quindi è lì che conviene essere leggeri.
  const COUNT = innerWidth < 760 ? 2600 : 6500;

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

  let renderer, scene, camera, ring, group, geo, uniforms, clock;
  let shapes = [];
  let scrollP = 0;
  let docMax = 1;                       // altezza scrollabile, letta solo al resize
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let morphed = 0;                      // posizione attuale nel morphing, smorzata

  function measureDoc() {
    docMax = Math.max(1, document.documentElement.scrollHeight - innerHeight - scrollBase);
  }

  function initGL() {
    const canvas = document.getElementById('scene');
    if (!canvas || !hasTHREE()) return false;

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

    clock = new THREE.Clock();
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

  /* Interruttore della scena 3D. Durante la prima parte dell'intro il sito è
     completamente coperto dal filmato: disegnare migliaia di particelle che
     nessuno vede toglierebbe al decoder video proprio il tempo di CPU e di GPU
     che serve a scorrere senza scatti. Si riaccende molto prima del raccordo,
     così la sfera è già viva e in rotazione quando la pagina prende il
     comando — non deve "comparire", deve trovarsi lì. */
  let glGate = true;

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (!renderer || !glGate) return;

    const el = clock.getElapsedTime();
    uniforms.uTime.value = el;

    // Lo scroll grezzo è a scatti: due smorzamenti in cascata (uno sulla
    // posizione, uno sul morphing) lo trasformano in un movimento continuo.
    // scrollBase toglie di mezzo la corsa dell'intro: per la scena 3D il
    // "punto zero" è la fine del filmato, così la sfera si trova nella sua
    // forma iniziale — la stessa che si vede nell'ultimo fotogramma — proprio
    // quando la pagina prende il comando.
    const sy = Math.max(0, scrollY - scrollBase);
    scrollP += (Math.min(1, sy / docMax) - scrollP) * 0.06;
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

    // La timeline dura ~4,25 s a velocità 1. Google considera "buono" un
    // Largest Contentful Paint sotto i 2,5 s, e finché il pannello copre lo
    // schermo il contenuto vero non è ancora dipinto: l'intro è il collo di
    // bottiglia dei Core Web Vitals, che sono un fattore di posizionamento.
    // 3,5× la porta a ~1,2 s — tutta la coreografia resta, semplicemente
    // scorre più svelta — e lascia margine sotto la soglia.
    // Chi l'ha già vista in questa sessione se la cava in ~0,7 s.
    // sessionStorage può lanciare (Safari in navigazione privata, cookie di
    // terze parti bloccati in iframe): in quel caso si mostra l'intro piena.
    let seen = false;
    try {
      seen = sessionStorage.getItem('fs_intro') === '1';
      sessionStorage.setItem('fs_intro', '1');
    } catch (err) { /* storage non disponibile: nessun problema */ }
    tl.timeScale(seen ? 6 : 3.5);

    // Il wordmark è testo SVG: con un font di sistema al posto di Inter Tight
    // le spaziature sarebbero tutte sbagliate. Si attende document.fonts, ma
    // non oltre 400 ms — i woff2 sono sul nostro dominio e in <link preload>,
    // quindi di norma sono pronti molto prima, e ogni millisecondo di attesa
    // qui è un millisecondo aggiunto all'LCP.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      tl.play();
    };
    setTimeout(start, 400);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  }

  /* ===========================================================================
     3b. INTRO — IL FILMATO GUIDATO DALLO SCROLL
     ===========================================================================
     L'idea, in una riga: il filmato non finisce, cambia supporto.

     L'ultimo fotogramma del video è questa stessa hero, renderizzata a
     1920×1080. Quindi il problema non è "far comparire il sito dopo il video",
     ma far coincidere due immagini della stessa cosa. Quello che segue fa
     esattamente tre cose:

       1. lega il tempo del video alla posizione di scroll (avanti e indietro);
       2. calcola, sul layout reale del momento, la trasformazione che porta il
          fotogramma finale sopra la hero vera — perché lo schermo di chi
          guarda quasi mai è 16:9 come il filmato;
       3. scambia i due strati mentre entrambi si stanno ancora muovendo, con
          lo stesso identico movimento: l'occhio segue il movimento e non si
          accorge della sostituzione.

     Punti di riferimento misurati sul fotogramma finale del filmato, in pixel
     del video (spazio 1280×720). Sono gli stessi elementi che il DOM espone
     qui sotto: il filetto sopra il sottotitolo, il logo nella nav, il bottone.
     =========================================================================== */

  const REF_W = 1280, REF_H = 720;

  /* Il filmato è a 30 fps esatti. Serve saperlo: cercare un istante qualunque
     dentro un fotogramma costringe il decoder a lavorare per poi mostrare
     comunque quel fotogramma, e due posizioni di scroll vicine possono
     cadere una prima e una dopo il confine — da lì nascono lo sfarfallio e i
     micro-blocchi. Si cerca invece il CENTRO del fotogramma voluto, e solo
     quando il fotogramma voluto cambia davvero. */
  const REF_FPS = 30;

  /* Tappe della corsa dell'intro, in frazione (0..1).
     Il video arriva all'ultimo fotogramma a ref.vEnd e da lì resta fermo: la
     coda di entrambi i filmati è già un'immagine statica (la camera ha finito
     di entrare), ed è su quell'immagine ferma che si costruisce il raccordo. */
  const V_END  = ref.vEnd;              // fine del filmato
  /* SET_A cade dove il filmato sta ancora rallentando: la correzione
     d'inquadratura comincia DENTRO il movimento del video invece che dopo, e
     per questo si legge come la fine della corsa della camera e non come un
     aggiustamento. Sulla maggior parte dei telefoni quella correzione è
     comunque prossima allo zero (il filmato è già inquadrato bene), quindi
     lì non si vede proprio nulla muoversi. */
  const SET_A  = 0.70, SET_B = 0.90;    // il quadro si allinea allo schermo

  /* Il passaggio attraverso il vetro.
     Sul telefono comincia esattamente dove il filmato finisce (ref.vEnd): la
     camera deve prima entrare del tutto nel display, e SOLO DOPO si
     attraversa. Farlo partire prima significherebbe dissolvere il video
     mentre sta ancora avvicinandosi — l'ingresso non si vedrebbe mai.
     Sul laptop resta breve e leggero, perché lì i due quadri combaciano
     davvero e più corto è, meno si nota. */
  const FADE_A = ref.layout === 'telefono' ? ref.vEnd : 0.92;
  const FADE_B = ref.layout === 'telefono' ? 1.00     : 0.978;

  /* Intensità dell'attraversamento. Sul telefono è un gesto dichiarato,
     perché lì il sito ripreso nel filmato ha un'altra impaginazione e la
     sfocatura è ciò che rende quella differenza illeggibile. Sul laptop i
     due quadri coincidono quasi al pixel: aggiungere spinta e sfocatura
     rovinerebbe un raccordo che già funziona, quindi restano quasi a zero. */
  const THRU_PUSH = ref.layout === 'telefono' ? 0.14 : 0.02;
  const THRU_BLUR = ref.layout === 'telefono' ? 9    : 0;
  const THRU_ARR  = ref.layout === 'telefono' ? 0.07 : 0.015;
  const LIVE_A = 0.90, LIVE_B = 1.00;   // ultimo tratto di corsa della camera
  const E_AMP  = 0.012;                 // ampiezza di quell'ultimo tratto

  const clamp01  = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg      = (p, a, b) => clamp01((p - a) / (b - a));
  const outCubic = t => 1 - Math.pow(1 - t, 3);
  const outQuad  = t => 1 - Math.pow(1 - t, 2);

  function initIntro() {
    const intro = introEl;
    const stage = document.getElementById('introStage');
    const vid   = introVideo;
    const hint  = document.getElementById('introHint');
    const mask  = document.getElementById('introNavMask');
    const hero  = document.querySelector('.hero');
    const stick = document.querySelector('.hero__sticky');
    const navEl = document.getElementById('nav');
    const scene = document.getElementById('scene');
    const cue   = document.querySelector('.hero__scroll');
    if (!intro || !stage || !vid || !hero || !stick) { disableIntro(); return; }

    if (cue) cue.style.opacity = '0';   // entra alla fine, vedi apply()

    let dur     = vid.duration || 8;
    let introPx = 0;
    let match   = { k: 1, tx: 0, ty: 0, sphere: 1, mask: false, maskY: 0 };
    let done    = false;
    let hintShown = true;   // stato del "Scorri per entrare": reversibile, vedi apply()
    let lastFrame = -1;   // ultimo fotogramma richiesto al decoder

    /* --- quanto scroll dura l'intro ---
       In pixel, non in vh: su mobile 100vh cambia quando la barra degli
       indirizzi si ritrae, e la corsa si allungherebbe a metà filmato. */
    let lastW = 0, lastH = 0;
    function measureIntro() {
      const w = innerWidth, h = innerHeight;
      // Su telefono la barra degli indirizzi che si ritrae genera un resize
      // di un centinaio di pixel: ricalcolare lì significherebbe allungare la
      // corsa mentre il filmato è a metà, cioè uno scatto.
      if (introPx && w === lastW && Math.abs(h - lastH) < 140) return;
      lastW = w; lastH = h;
      introPx = Math.round(h * (w < 900 ? 2.6 : 3.8));
      scrollBase = introPx;
      document.documentElement.style.setProperty('--intro-scroll', introPx + 'px');
    }

    /* --- il cuore: dove finisce il filmato deve esserci la pagina ---

       Il video viene disegnato con object-fit:cover, quindi so esattamente
       dove finisce sullo schermo un qualunque punto del filmato. Confronto
       quei punti con la posizione reale degli stessi elementi nel DOM e cerco
       l'unica scala + traslazione che li fa combaciare meglio di qualunque
       altra (minimi quadrati su una similitudine, senza rotazione).

       Perché non basta sovrapporre e basta: il filmato è 16:9 e ha un layout
       "grande" (a 1920 tutte le clamp() del CSS sono al massimo), mentre lo
       schermo di chi guarda è quasi sempre 16:10 e ha misure più piccole. Il
       filetto della hero pesa 3 e la nav 1 perché il blocco del titolo è la
       massa visiva che l'occhio usa come riferimento: se combacia quello,
       combacia la scena.

       Su 1920×1080 il risultato è una coincidenza pressoché esatta; su
       1440×900 lo scarto massimo resta di una decina di pixel, su testo
       piccolo, e durante un movimento. */
    function computeMatch() {
      const vw = innerWidth, vh = innerHeight;
      const s0 = Math.max(vw / REF_W, vh / REF_H);      // scala di object-fit:cover
      const toScreen = p => [ vw / 2 + (p[0] - REF_W / 2) * s0,
                              vh / 2 + (p[1] - REF_H / 2) * s0 ];

      const meta  = document.querySelector('.hero__meta');
      const title = document.querySelector('.hero__title');
      const off   = { k: 1, tx: 0, ty: 0, sphere: 1, maskY: 0, mask: false, fitted: false };

      /* --- TELEFONO: si ancora allo SCHERMO, non al testo ---------------
         Qui il filmato inquadra un telefono, e il telefono ha un bordo:
         un oggetto fisico, netto, misurabile. Ancorarsi a quello significa
         che la corsa finisce esattamente dentro il display, centrata.

         Ancorarsi invece al testo del sito — come si fa più sotto per il
         laptop — qui è sbagliato, e i numeri lo dicono: il sito ripreso
         dentro il filmato ha un'altra impaginazione (il filetto cade al 64%
         dell'altezza, nella pagina vera al 78%). Inseguendo quel testo la
         trasformazione diventava k=1,22 con 55px di scarto laterale: il
         quadro zoomava del 22% in eccesso e usciva dal centro. Il video da
         solo, senza correzioni, era già a meno di mezzo pixel dal giusto.

         Il conto è diretto: lo schermo occupa mezza larghezza REF_SCREEN_HW
         attorno a REF_SCREEN_CX, e deve finire largo quanto il viewport. */
      if (ref.layout === 'telefono' && ref.screenHW) {
        const kS = (vw / 2) / (ref.screenHW * s0);
        const cxScreen = toScreen([ref.screenCX, REF_H / 2]);
        return {
          k:  kS,
          tx: vw / 2 - kS * cxScreen[0],
          ty: vh / 2 - kS * cxScreen[1],
          // la sfera scala con l'altezza del quadro, come sempre
          sphere: (REF_H * s0 * kS) / vh,
          mask: false, maskY: 0,
          fitted: true
        };
      }

      /* Il raccordo al pixel si calcola solo se la pagina qui sotto è
         impaginata come quella ripresa nel filmato in corso: il layout mobile
         del CSS (fino a 480px) per il video del telefono, quello pieno (da
         900px) per il laptop. Altrimenti allineare due composizioni diverse
         peggiorerebbe le cose: si resta sul quadro pieno e si allunga lo
         scambio, che è il ramo `fitted:false`. */
      const phoneLayout = matchMedia('(max-width: 480px)').matches;
      const layoutOk = ref.layout === 'telefono' ? phoneLayout
                                                 : (!phoneLayout && vw >= 900);
      if (!meta || !title || !layoutOk) return off;

      const m = meta.getBoundingClientRect();
      const t = title.getBoundingClientRect();
      if (!t.width || !m.width) return off;

      /* Il blocco del titolo pesa 5 e il filetto 1. Non è arbitrario: il
         titolo occupa da solo quasi metà del quadro ed è l'unica cosa che
         l'occhio usa davvero come riferimento. Se combacia lui, combacia la
         scena; se sacrificassi lui per far quadrare i dettagli, si vedrebbe. */
      const pts = [
        [toScreen(ref.titleTL), [t.left,  t.top],    5],
        [toScreen(ref.titleBR), [t.right, t.bottom], 5],
        [toScreen(ref.ruleL),   [m.left,  m.top],    1],
        [toScreen(ref.ruleR),   [m.right, m.top],    1]
      ];

      let W = 0, ax = 0, ay = 0, bx = 0, by = 0;
      for (const [a, b, w] of pts) {
        W += w; ax += a[0] * w; ay += a[1] * w; bx += b[0] * w; by += b[1] * w;
      }
      ax /= W; ay /= W; bx /= W; by /= W;

      let num = 0, den = 0;
      for (const [a, b, w] of pts) {
        const dax = a[0] - ax, day = a[1] - ay;
        num += w * (dax * (b[0] - bx) + day * (b[1] - by));
        den += w * (dax * dax + day * day);
      }
      let k = den > 1e-6 ? num / den : 1;
      k = Math.min(2, Math.max(0.45, k));       // guardia contro misure assurde
      const tx = bx - k * ax, ty = by - k * ay;

      /* La nav è il punto in cui questo metodo tocca il proprio limite, ed è
         onesto dirlo: è ancorata in ALTO mentre tutta la hero è ancorata in
         BASSO. Se lo schermo non ha le proporzioni del filmato, nessuna
         singola scala può soddisfarle entrambe — o combacia la nav o combacia
         il titolo, e il titolo vale incomparabilmente di più.
         Quindi: si misura di quanto la nav sbaglierebbe. Se lo scarto è
         trascurabile (schermo 16:9, il caso in cui il filmato è stato
         prodotto) non si fa nulla e combacia tutto. Se è visibile, la fascia
         alta del filmato viene spenta sul nero prima dello scambio: la nav
         del video si dissolve nel fondo e riappare, un istante dopo, quella
         vera al proprio posto. Due eventi piccoli e scuri al posto di un
         salto di cento pixel. */
      let mask = false, maskY = 0;
      const markEl = document.querySelector('.nav__mark');
      if (markEl) {
        const r = markEl.getBoundingClientRect();
        const a = toScreen(ref.mark);
        const dx = k * a[0] + tx - (r.left + r.width / 2);
        const dy = k * a[1] + ty - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) > 14) {
          mask  = true;
          maskY = Math.max(0, vh / 2 + (ref.topBand - REF_H / 2) * s0);
        }
      }

      /* La sfera merita un conto a parte. Il suo raggio a schermo dipende solo
         dall'altezza del viewport (la camera three.js ha fov verticale): nel
         filmato vale C·720 pixel-video, nella pagina C·innerHeight. Questo
         rapporto dice di quanto va scalata la scena 3D perché, nell'istante
         dello scambio, sia la STESSA sfera — stesso centro, stesso diametro,
         stessa densità apparente di puntini. Da lì torna a 1 accompagnando
         l'ultimo tratto di camera, invece di saltare. */
      const sphere = (REF_H * s0 * k) / vh;

      return { k, tx, ty, sphere, mask, maskY, fitted: true };
    }

    /* Disegna lo stato corrispondente a una posizione `p` (0..1) della corsa.
       Nessun ramo "avanti/indietro": p è funzione pura dello scroll, quindi
       risalire ripercorre esattamente la stessa strada al contrario. */
    function apply(p) {

      /* 1 — il fotogramma.
         Tre accorgimenti, e servono tutti e tre:

         · si ragiona in NUMERO di fotogramma, non in secondi. Fra due
           posizioni di scroll vicinissime il fotogramma da mostrare è lo
           stesso: senza questo controllo si chiederebbero decine di ricerche
           al secondo che finiscono tutte sulla stessa immagine — lavoro
           inutile che il decoder paga con micro-blocchi.
         · si cerca il CENTRO del fotogramma (+0,5). Puntare al confine
           esatto lascia decidere all'arrotondamento quale dei due mostrare,
           e a ogni frame può cambiare idea: è esattamente lo sfarfallio.
         · non si chiede nulla mentre `seeking` è true. Accodare ricerche a
           un decoder che sta già cercando è il modo più rapido per farlo
           singhiozzare. */
      /* Basta avere i metadati (readyState 1): assegnare currentTime scatena
         comunque il recupero del pezzo di file che serve, e il fotogramma
         arriva. Pretendere readyState 2 significava, su iOS, non cercare mai. */
      if (vid.readyState >= 1) {
        const nFrames = Math.max(1, Math.round(dur * REF_FPS));
        const idx = Math.round(clamp01(p / V_END) * (nFrames - 1));
        if (idx !== lastFrame && !vid.seeking) {
          lastFrame = idx;
          try {
            vid.currentTime = Math.min(dur - 1e-3, (idx + 0.5) / REF_FPS);
          } catch (err) { lastFrame = -1; /* rifiutata: si riprova al frame dopo */ }
        }
      }

      /* 2 — il quadro si allinea alla pagina.
         Succede mentre il filmato è già fermo sull'ultimo fotogramma: non si
         legge come una correzione, si legge come la camera che si assesta. */
      const s  = outCubic(seg(p, SET_A, SET_B));
      const mk = 1 + (match.k - 1) * s;
      const mx = match.tx * s;
      const my = match.ty * s;

      // Fascia alta: si spegne insieme al raccordo, e solo dove serve
      // davvero (vedi computeMatch). Su 16:9 resta a zero e la nav del
      // filmato passa direttamente in quella vera.
      if (mask && match.mask) mask.style.opacity = String(s);

      /* 3 — l'ultimo tratto di camera, condiviso.
         `e` viene applicato IDENTICO al video e alla pagina vera. È questo il
         motivo per cui lo scambio non si vede: nell'istante in cui avviene, i
         due strati non sono due immagini ferme leggermente diverse, ma la
         stessa immagine che si sta muovendo allo stesso modo. */
      const l   = outQuad(seg(p, LIVE_A, LIVE_B));
      const e   = 1 - E_AMP * (1 - l);
      const cx  = innerWidth / 2, cy = innerHeight / 2;
      const eTx = cx * (1 - e), eTy = cy * (1 - e);

      /* --- il passaggio attraverso il vetro --------------------------------
         `thru` sale da 0 a 1 nell'ultimo tratto, quello in cui la camera
         "entra". Non è una dissolvenza: è il gesto di attraversare una
         superficie. Il filmato continua a spingersi avanti (PUSH) e va fuori
         fuoco, come quando un obiettivo supera il piano su cui era a fuoco;
         la pagina vera arriva dall'altra parte assestandosi da poco più
         vicino. Il fuori fuoco fa un secondo lavoro, altrettanto importante:
         il sito ripreso nel filmato ha un'impaginazione diversa da quella
         reale, e la sfocatura rende quella differenza illeggibile proprio
         nell'istante in cui i due strati si scambiano. */
      /* smoothstep e non outCubic: quest'ultima è tutta all'inizio, e faceva
         sparire il filmato nei primi istanti della finestra invece che nel
         mezzo. Qui serve una curva simmetrica — parte piano, accelera al
         centro, si posa piano — perché l'attraversamento è un gesto, non una
         sparizione. */
      const tRaw  = seg(p, FADE_A, FADE_B);
      const thru  = tRaw * tRaw * (3 - 2 * tRaw);
      const push  = 1 + THRU_PUSH * thru;
      const blur  = (THRU_BLUR * thru).toFixed(2);

      // video: raccordo, poi camera condivisa, poi la spinta finale
      const vk  = e * mk * push;
      const vTx = push * (e * mx + eTx) + cx * (1 - push);
      const vTy = push * (e * my + eTy) + cy * (1 - push);
      stage.style.transform =
        'translate(' + vTx.toFixed(2) + 'px,' + vTy.toFixed(2) + 'px) scale(' + vk.toFixed(5) + ')';
      stage.style.filter = (THRU_BLUR && thru > 0) ? 'blur(' + blur + 'px)' : '';

      /* La pagina vera arriva dall'altra parte del vetro: parte un filo più
         vicina e si assesta mentre il filmato la attraversa. È il movimento
         che fa leggere lo scambio come "sono entrato", invece che come "è
         comparso qualcos'altro". */
      const arrive = 1 + THRU_ARR * (1 - thru);
      const pk  = e * arrive;
      const pTx = cx * (1 - pk), pTy = cy * (1 - pk);
      const pageT = 'translate(' + pTx.toFixed(2) + 'px,' + pTy.toFixed(2) + 'px) scale(' + pk.toFixed(5) + ')';
      stick.style.transform = pageT;
      if (navEl) navEl.style.transform = pageT;

      // sfondo 3D: stesso arrivo della pagina + assestamento della sfera
      if (scene) {
        const sk = pk * (1 + (match.sphere - 1) * (1 - l));
        scene.style.transform =
          'translate(' + (cx * (1 - sk)).toFixed(2) + 'px,' + (cy * (1 - sk)).toFixed(2) + 'px) ' +
          'scale(' + sk.toFixed(5) + ')';
      }

      /* 4 — lo scambio. L'opacità segue la STESSA curva della spinta e della
         sfocatura: il filmato si dissolve mentre attraversa, non prima e non
         dopo. Un solo gesto, non due eventi sovrapposti. */
      intro.style.opacity = (1 - thru).toFixed(3);

      /* L'indicatore "Scorri" nell'ultimo fotogramma del filmato non c'è: il
         quadro del video si ferma poco sopra. Farlo comparire insieme allo
         scambio sarebbe l'unico dettaglio a tradire il passaggio, quindi
         entra subito dopo, quando il sito ha già preso il comando — si legge
         come l'invito a proseguire, non come un pezzo che spunta. */
      if (cue) cue.style.opacity = String(seg(p, 0.965, 1));

      /* Reversibile, non un one-shot: al primo movimento si dissolve, ma se si
         risale fino a tornare al fotogramma di partenza deve trovarsi lì di
         nuovo — è di nuovo il primo fotogramma, quindi è di nuovo vero
         l'invito a scorrere. hintShown tiene lo stato per non ripetere lo
         stesso tween a ogni chiamata mentre si sta dalla stessa parte della
         soglia. */
      const hintShouldShow = p <= 0.012;
      if (hint && hintShouldShow !== hintShown) {
        hintShown = hintShouldShow;
        gsap.to(hint, { opacity: hintShouldShow ? 1 : 0, duration: 0.5, ease: 'power2.out' });
      }

      /* 5 — risorse.
         Fino a metà corsa il filmato copre tutto: la scena 3D resta spenta e
         il nastro scorrevole fermo, e tutto il tempo macchina va al decoder.
         Da metà in poi si riaccende ogni cosa, con largo anticipo sul
         raccordo, così alla consegna la sfera sta già girando. */
      const live = p >= 0.5;
      if (live !== glGate) {
        glGate = live;
        document.documentElement.classList.toggle('intro-idle', !live);
        if (marqueeTween) live ? marqueeTween.play() : marqueeTween.pause();
      }

      /* 6 — fine corsa: l'intro esce di scena e la pagina torna pulita.
         Reversibile, perché si può sempre risalire. */
      const shouldEnd = p >= 0.999;
      if (shouldEnd !== done) {
        done = shouldEnd;
        intro.classList.toggle('is-done', done);
        if (done) {
          stick.style.transform = '';
          if (navEl) navEl.style.transform = '';
          if (scene) scene.style.transform = '';
          // il filtro va tolto esplicitamente: una blur() dimenticata su un
          // elemento a schermo intero resta a costare GPU per tutta la visita
          stage.style.filter = '';
        }
      }
    }

    /* --- collegamento allo scroll ---
       scrub non è un vezzo: trasforma i gradini della rotella in una corsa
       continua, ed è ciò che tiene lontani scatti e micro-blocchi quando il
       decoder impiega qualche millisecondo in più a servire un fotogramma. */
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1, duration: 1, ease: 'none',
      onUpdate: () => apply(proxy.p),
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => '+=' + introPx,
        scrub: 0.5,
        invalidateOnRefresh: true
      }
    });
    const st = tween.scrollTrigger;

    // Il raccordo dipende dal layout: va ricalcolato a ogni rimisurazione,
    // non una volta sola. La maschera cambia solo qui, non a ogni fotogramma.
    function remeasure() {
      // Le misure vanno prese sul layout NUDO: se restassero applicate le
      // trasformazioni del raccordo, getBoundingClientRect le includerebbe e
      // il calcolo si inseguirebbe da solo a ogni ridimensionamento.
      const ps = stick.style.transform, pn = navEl ? navEl.style.transform : '';
      stick.style.transform = '';
      if (navEl) navEl.style.transform = '';

      match = computeMatch();

      stick.style.transform = ps;
      if (navEl) navEl.style.transform = pn;

      measureDoc();
      if (mask) {
        mask.style.height = 'calc(100% + ' + match.maskY.toFixed(1) + 'px)';
        if (!match.mask) mask.style.opacity = '0';
      }
    }

    // L'altezza della hero dipende da --intro-scroll: va scritta PRIMA che
    // ScrollTrigger prenda le misure, non dopo.
    ScrollTrigger.addEventListener('refreshInit', measureIntro);
    ScrollTrigger.addEventListener('refresh', remeasure);

    measureIntro();
    ScrollTrigger.refresh();
    remeasure();
    apply(0);

    // Metadati: la durata reale sostituisce la stima appena disponibile.
    if (vid.readyState < 1) {
      vid.addEventListener('loadedmetadata', () => {
        dur = vid.duration || dur;
        apply(proxy.p);
      }, { once: true });
    } else {
      dur = vid.duration || dur;
    }
    // Primo fotogramma disponibile: si ridisegna, altrimenti finché non si
    // scorre il video resterebbe vuoto.
    vid.addEventListener('loadeddata', () => apply(proxy.p), { once: true });

    // Se il file non arriva proprio, meglio un sito senza intro che un sito
    // con dieci schermate di nero.
    /* Rete di sicurezza. La condizione è "nemmeno i metadati": con quelli lo
       scrubbing funziona, quindi rinunciare a readyState 1 sarebbe stato un
       falso allarme — ed era proprio il falso allarme che su iPhone spegneva
       un'intro perfettamente funzionante. */
    setTimeout(() => {
      if (vid.readyState >= 1) return;
      if (st) st.kill();
      tween.kill();
      if (cue) cue.style.opacity = '';
      scrollTo(0, 0);            // la hero si accorcia: meglio ripartire da capo
      disableIntro();
    }, 12000);

    // Il logo della nav punta a #top, che con l'intro coincide con l'inizio
    // del filmato: cliccandolo si tornerebbe al laptop. Deve invece riportare
    // all'inizio del sito.
    const logo = document.querySelector('.nav__logo');
    if (logo) {
      logo.addEventListener('click', ev => {
        ev.preventDefault();
        scrollTo({ top: scrollBase, behavior: 'smooth' });
      });
    }
  }

  /* Rimette il sito com'era: usata sia quando l'intro non è supportata sia
     quando il video non si carica. */
  function disableIntro() {
    glGate = true;
    if (marqueeTween) marqueeTween.play();
    document.documentElement.classList.remove('intro-idle');
    document.documentElement.classList.remove('has-intro');
    document.documentElement.style.removeProperty('--intro-scroll');
    if (introEl) introEl.style.display = 'none';

    // Le trasformazioni di raccordo vanno tolte, altrimenti la pagina
    // resterebbe congelata al 98,8% con la sfera fuori scala.
    ['.hero__sticky', '.nav', '#scene'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.style.transform = '';
    });

    scrollBase = 0;
    measureDoc();
    if (hasST) ScrollTrigger.refresh();
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
        // scrollBase: durante l'intro la pagina è ferma, la nav non deve
        // compattarsi mentre scorre il filmato
        onUpdate: self => nav.classList.toggle('is-stuck', self.scroll() > scrollBase + 80)
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

  let marqueeTween = null;   // messo in pausa durante l'intro, vedi apply()

  function marquee() {
    const track = document.getElementById('marqueeTrack');
    if (!track) return;

    const span = track.querySelector('span');
    if (!span) return;
    for (let i = 0; i < 3; i++) track.appendChild(span.cloneNode(true));

    if (!hasGSAP || reduced) return;
    marqueeTween = gsap.to(track, { xPercent: -25, duration: 26, ease: 'none', repeat: -1 });
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
     9. CARICAMENTO DIFFERITO DELLO SFONDO 3D
     ===========================================================================
     three.min.js pesa ~600 KB: più di tutto il resto del sito messo insieme.
     Serve solo alla nuvola di particelle, che è decorazione. Tenerlo nell'HTML
     significava farlo scaricare e parsare prima del primo fotogramma utile,
     rubando tempo esattamente alle due metriche che Google usa per il
     posizionamento: LCP (quanto ci mette a comparire il contenuto) e INP
     (quanto è reattiva la pagina al primo tocco).

     Qui invece parte a intro finita e a browser scarico. Se non arriva —
     rete lenta, file mancante, risparmio dati attivo — il sito resta
     esattamente com'è, solo senza sfondo animato.
     =========================================================================== */

  /* Inserisce uno <script> dal nostro dominio.
     `src` è sempre una costante scritta qui dentro: nessun valore proveniente
     dall'esterno finisce mai in un tag script — e comunque la CSP consente
     solo script-src 'self'. */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`caricamento fallito: ${src}`));
      document.head.appendChild(s);
    });
  }

  function loadBackground(eager) {
    if (reduced) return;

    // Rispetta chi ha attivato il risparmio dati e chi ha poca memoria:
    // scaricare mezzo megabyte per un fondale sarebbe sgarbato.
    const conn = navigator.connection;
    if (conn && conn.saveData) return;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return;

    const go = () => loadScript('vendor/three.min.js')
      .then(() => { if (initGL()) renderLoop(); })
      .catch(() => { /* nessuno sfondo: la pagina funziona identica */ });

    // Con l'intro non si può aspettare: la sfera deve già girare quando il
    // filmato consegna la scena. Se arrivasse dopo, comparirebbe dal nulla
    // proprio nel punto in cui il raccordo deve essere invisibile.
    if (eager) { go(); return; }

    // requestIdleCallback aspetta che il browser non abbia altro da fare;
    // il timeout garantisce che non venga rimandato all'infinito.
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 800);
  }

  /* ===========================================================================
     10. BOOT
     =========================================================================== */

  /* Pannello di diagnosi, attivo SOLO aprendo il sito con ?diag=1 in coda
     all'indirizzo. Su un telefono non esiste una console da guardare: questo
     mette a schermo, in chiaro, tutte le condizioni che decidono se l'intro
     parte e quale filmato usa. Una fotografia dello schermo basta a capire
     quale ha detto no. Non costa nulla a chi non lo apre: senza il parametro
     la funzione esce alla prima riga. */
  function introDiag() {
    if (!/[?&]diag=1(&|$)/.test(location.search)) return;

    const v = introVideo;
    const righe = [
      ['schermo',        () => innerWidth + '×' + innerHeight],
      ['touch',          () => isTouch],
      ['verticale',      () => isPortrait],
      ['-> filmato',     () => ref.src.split('/').pop()],
      ['meno movimento', () => reduced],
      ['risparmio dati', () => (netInfo ? !!netInfo.saveData : 'n/d')],
      ['memoria GB',     () => (navigator.deviceMemory || 'n/d')],
      ['GSAP',           () => hasGSAP],
      ['ScrollTrigger',  () => hasST],
      ['INTRO ATTIVA',   () => introOn],
      ['corsa intro',    () => document.documentElement.style
                                 .getPropertyValue('--intro-scroll') || '(vuota)'],
      ['video pronto',   () => (v ? v.readyState : 'n/d')],
      ['video errore',   () => (v && v.error ? v.error.code : 'no')],
      ['secondo video',  () => (v ? v.currentTime.toFixed(2) : 'n/d')]
    ];

    const box = document.createElement('div');
    const s = box.style;
    s.position = 'fixed'; s.left = '8px'; s.top = '8px'; s.zIndex = '99999';
    s.background = 'rgba(0,0,0,.92)'; s.color = '#7CFFB2';
    s.font = '11px/1.45 ui-monospace, monospace';
    s.padding = '10px 12px'; s.borderRadius = '8px';
    s.whiteSpace = 'pre'; s.pointerEvents = 'none';
    s.border = '1px solid rgba(124,255,178,.35)';

    const disegna = () => {
      let t = '';
      for (const [k, val] of righe) {
        let v2;
        try { v2 = String(val()); } catch (err) { v2 = 'errore'; }
        t += (k + '               ').slice(0, 15) + ' ' + v2 + '\n';
      }
      box.textContent = t.trimEnd();
    };
    disegna();
    setInterval(disegna, 400);
    document.body.appendChild(box);
  }

  function boot() {
    introDiag();
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

    runLoader(() => {
      // Con l'intro la hero non "entra": è già entrata dentro al filmato.
      // Deve trovarsi composta e ferma, identica all'ultimo fotogramma, così
      // che il raccordo non debba far combaciare anche due animazioni.
      if (introOn) { composeHero(); initIntro(); }
      else heroIn();

      scrollAnims();
      // Le misure di ScrollTrigger sono state prese mentre il preloader
      // copriva la pagina: vanno rifatte ora che il layout è quello vero.
      if (hasST) ScrollTrigger.refresh();
      measureDoc();
      // Sfondo 3D: subito se c'è l'intro, altrimenti quando il browser è
      // libero — la parte pesante arriva quando il contenuto è già leggibile.
      loadBackground(introOn);
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
