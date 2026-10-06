// Planar tracker: allinea il contenuto dello schermo del fotogramma 167 (modello)
// a ogni altro fotogramma con un'omografia + guadagno/offset di luminosità.
// Spazio di lavoro F: pixel del fotogramma a 1920×1080. Coordinate normalizzate:
// n = (X - 960) / 960, (Y - 540) / 960.
window.TR = (() => {
  const FW = 1920, FH = 1080, NORM = 960, CX = 960, CY = 540;
  const N = 168;

  function gray(d, n) {
    const g = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return g;
  }
  function half(src, w, h) {
    const w2 = w >> 1, h2 = h >> 1, out = new Float32Array(w2 * h2);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * w2 + x] = (src[i] + src[i + 1] + src[i + w] + src[i + w + 1]) * 0.25;
    }
    return out;
  }
  function blur3(g, w, h) {   // [1 2 1] separabile, per gradienti puliti
    const t = new Float32Array(g.length), o = new Float32Array(g.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, l = x ? i - 1 : i, r = x < w - 1 ? i + 1 : i;
      t[i] = (g[l] + 2 * g[i] + g[r]) * 0.25;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, u = y ? i - w : i, d = y < h - 1 ? i + w : i;
      o[i] = (t[u] + 2 * t[i] + t[d]) * 0.25;
    }
    return o;
  }
  function level(g, w, h, s) {
    const b = blur3(g, w, h);
    const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = (b[i + 1] - b[i - 1]) * 0.5;
      gy[i] = (b[i + w] - b[i - w]) * 0.5;
    }
    return { w, h, s, g: b, gx, gy };
  }
  async function pyramid(idx) {
    const blob = await fetch(`assets/frames/desktop/1920/${String(idx).padStart(3, '0')}.webp?t=1`).then(r => r.blob());
    const bm = await createImageBitmap(blob);
    const c = new OffscreenCanvas(960, 540), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(bm, 0, 0, 960, 540); bm.close();
    const g1 = gray(x.getImageData(0, 0, 960, 540).data, 960 * 540);
    const g2 = half(g1, 960, 540);
    const g3 = half(g2, 480, 270);
    return [level(g3, 240, 135, 8), level(g2, 480, 270, 4), level(g1, 960, 540, 2)];
  }

  // campioni del modello per livello: coordinate normalizzate + valore
  function samples(L, stride) {
    const pts = [];
    for (let y = 2; y < L.h - 2; y += stride) for (let x = 2; x < L.w - 2; x += stride) {
      const X = (x + 0.5) * L.s - 0.5, Y = (y + 0.5) * L.s - 0.5;
      pts.push((X - CX) / NORM, (Y - CY) / NORM, L.g[y * L.w + x]);
    }
    return new Float32Array(pts);
  }

  function bil(arr, w, x, y) {
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + w] * (1 - fx) + arr[i + w + 1] * fx) * fy;
  }

  function solve(A, b, n) {   // Gauss con pivot parziale
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; if (Math.abs(d) < 1e-12) return null;
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }

  // p = [h0..h7, a, b]
  function align(L, S, p0, iters) {
    let p = p0.slice(), sigma = 20, lambda = 1e-3, prevCost = Infinity, last = null;
    for (let it = 0; it < iters; it++) {
      const JTJ = Array.from({ length: 10 }, () => new Float64Array(10)), JTr = new Float64Array(10);
      const [h0, h1, h2, h3, h4, h5, h6, h7, a, b] = p;
      let cost = 0, used = 0; const res = [];
      const k = NORM / L.s, J = new Float64Array(10);
      for (let i = 0; i < S.length; i += 3) {
        const un = S[i], vn = S[i + 1], T = S[i + 2];
        const w = h6 * un + h7 * vn + 1;
        const px = (h0 * un + h1 * vn + h2) / w, py = (h3 * un + h4 * vn + h5) / w;
        const lx = (px * NORM + CX + 0.5) / L.s - 0.5, ly = (py * NORM + CY + 0.5) / L.s - 0.5;
        if (lx < 1 || ly < 1 || lx > L.w - 3 || ly > L.h - 3) continue;
        const I = bil(L.g, L.w, lx, ly);
        const gxn = bil(L.gx, L.w, lx, ly) * k, gyn = bil(L.gy, L.w, lx, ly) * k;
        const r = I - (a * T + b);
        const ar = Math.abs(r), c = 1.345 * sigma, wt = ar <= c ? 1 : c / ar;   // Huber
        res.push(ar);
        cost += wt * r * r; used++;
        const iw = 1 / w, gp = (gxn * px + gyn * py) * iw;
        J[0] = gxn * un * iw; J[1] = gxn * vn * iw; J[2] = gxn * iw;
        J[3] = gyn * un * iw; J[4] = gyn * vn * iw; J[5] = gyn * iw;
        J[6] = -gp * un; J[7] = -gp * vn; J[8] = -T; J[9] = -1;
        for (let m = 0; m < 10; m++) { const jm = J[m] * wt; JTr[m] += jm * r; for (let n = m; n < 10; n++) JTJ[m][n] += jm * J[n]; }
      }
      for (let m = 0; m < 10; m++) for (let n = 0; n < m; n++) JTJ[m][n] = JTJ[n][m];
      res.sort((x, y) => x - y);
      sigma = Math.max(2, 1.4826 * (res[res.length >> 1] || 20));
      if (cost > prevCost * 1.0001 && last) { p = last; lambda *= 10; } else { lambda = Math.max(1e-6, lambda * 0.3); prevCost = cost; }
      const A = JTJ.map((row, m) => Array.from(row, (v, n) => v + (m === n ? lambda * (v || 1) : 0)));
      const d = solve(A, Array.from(JTr, v => -v), 10);
      if (!d) break;
      last = p.slice();
      p = p.map((v, m) => v + d[m]);
      const step = Math.hypot(d[0], d[1], d[2], d[3], d[4], d[5], d[6] * 2, d[7] * 2);
      if (step < 2e-6) break;
      align.info = { rms: Math.sqrt(prevCost / Math.max(1, used)), used, sigma, it };
    }
    return p;
  }

  // composizione di omografie normalizzate: A·B
  const toM = p => [[p[0], p[1], p[2]], [p[3], p[4], p[5]], [p[6], p[7], 1]];
  function mul(A, B) { const C = [[0,0,0],[0,0,0],[0,0,0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i][j] += A[i][k] * B[k][j]; return C; }
  function inv(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
            [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
            [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  const fromM = m => [m[0][0] / m[2][2], m[0][1] / m[2][2], m[0][2] / m[2][2], m[1][0] / m[2][2], m[1][1] / m[2][2], m[1][2] / m[2][2], m[2][0] / m[2][2], m[2][1] / m[2][2]];

  const state = { H: {}, info: {}, tmpl: null };
  async function init() {
    const P = await pyramid(N - 1);
    state.tmpl = [samples(P[0], 1), samples(P[1], 1), samples(P[2], 2)];
    state.H[N - 1] = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    return state.tmpl.map(s => s.length / 3);
  }
  async function track(from, to) {
    const log = [];
    for (let f = from; f >= to; f--) {
      const t0 = performance.now();
      const P = await pyramid(f);
      // previsione a velocità costante
      const h1 = state.H[f + 1], h2 = state.H[f + 2];
      let p0 = h1.slice();
      if (h2) {
        const M1 = toM(h1), M2 = toM(h2);
        const pred = fromM(mul(mul(M1, inv(M2)), M1));
        p0 = [...pred, h1[8], h1[9]];
      }
      let p = align(P[0], state.tmpl[0], p0, 30);
      p = align(P[1], state.tmpl[1], p, 20);
      p = align(P[2], state.tmpl[2], p, 12);
      state.H[f] = p;
      state.info[f] = Object.assign({}, align.info);
      log.push(`${f}: rms ${align.info.rms.toFixed(1)} a ${p[8].toFixed(3)} b ${p[9].toFixed(1)} it ${align.info.it} (${Math.round(performance.now() - t0)}ms)`);
    }
    return log;
  }
  // mappa un punto F del modello (fotogramma 167) nel fotogramma f
  function mapPt(f, X, Y) {
    const p = state.H[f], un = (X - CX) / NORM, vn = (Y - CY) / NORM;
    const w = p[6] * un + p[7] * vn + 1;
    return [((p[0] * un + p[1] * vn + p[2]) / w) * NORM + CX, ((p[3] * un + p[4] * vn + p[5]) / w) * NORM + CY];
  }
  return { init, track, state, mapPt, pyramid, inv, toM, mul, fromM };
})();
'TR pronto';
