/* textures.js — procedural planet textures, so the project works offline with no
   image files. Each planet gets a colour map AND a matching bump map. To use real
   photo textures instead, load them with THREE.TextureLoader and assign to
   material.map / material.bumpMap in main.js. */

// Seeded value noise + fractal Brownian motion
function makeNoise(seed) {
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const smooth = t => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), c = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 5) => { let v = 0, amp = .5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f); f *= 2; amp *= .5; } return v; };
}

function samplePalette(pal, t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < pal.length; i++) if (t <= pal[i][0]) {
    const [t0, c0] = pal[i - 1], [t1, c1] = pal[i], k = (t - t0) / (t1 - t0 || 1);
    return c0.map((v, j) => v + (c1[j] - v) * k);
  }
  return pal[pal.length - 1][1];
}

// Returns { map, bump } canvas textures for a planet definition
function makePlanetTextures(p, W = 1024, H = 512) {
  const fbm = makeNoise(p.seed);
  const cMap = document.createElement('canvas'), cBump = document.createElement('canvas');
  cMap.width = cBump.width = W; cMap.height = cBump.height = H;
  const x1 = cMap.getContext('2d'), x2 = cBump.getContext('2d');
  const i1 = x1.createImageData(W, H), i2 = x2.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, o = (y * W + x) * 4;
    let t;
    if (p.bands) {                      // gas giants: stripes distorted by noise
      t = .5 + .5 * Math.sin(v * p.bands * Math.PI * 2 + fbm(u * 6, v * 3) * 5);
      t = t * .7 + fbm(u * 10, v * 40, 3) * .3;
    } else {                            // rocky planets: continents / craters
      t = fbm(u * 8, v * 4, 6);
      if (p.earth) { const pole = Math.abs(v - .5) * 2; t = pole > .9 ? 1 : Math.min(t, .95); } // ice caps
    }
    const c = samplePalette(p.palette, t);
    const b = p.earth && t < .48 ? 90 : 255 * fbm(u * 16, v * 8, 5);   // flat oceans
    i1.data.set([c[0], c[1], c[2], 255], o);
    i2.data.set([b, b, b, 255], o);
  }
  x1.putImageData(i1, 0, 0); x2.putImageData(i2, 0, 0);
  return { map: new THREE.CanvasTexture(cMap), bump: new THREE.CanvasTexture(cBump) };
}

// Glowing turbulent surface for the Sun
function makeSunTexture(W = 1024, H = 512) {
  const fbm = makeNoise(99), c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const pal = [[0,[200,70,0]],[.5,[255,150,20]],[1,[255,240,160]]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const col = samplePalette(pal, fbm(x / W * 10, y / H * 5, 6) * 1.4);
    img.data.set([col[0], col[1], col[2], 255], (y * W + x) * 4);
  }
  ctx.putImageData(img, 0, 0); return new THREE.CanvasTexture(c);
}

// Saturn's ring: concentric bands with gaps, transparent at the edges
function makeRingTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 4;
  const ctx = c.getContext('2d'), fbm = makeNoise(42);
  for (let x = 0; x < 512; x++) {
    const a = Math.max(0, fbm(x / 20, 0, 3) * 1.6 - .25) * (x > 200 && x < 215 ? .1 : 1) * Math.min(1, x / 30) * Math.min(1, (512 - x) / 30);
    ctx.fillStyle = `rgba(220,200,160,${Math.min(a, .9)})`; ctx.fillRect(x, 0, 1, 4);
  }
  return new THREE.CanvasTexture(c);
}

// Soft purple/blue/pink nebula with a faint milky-way band, drawn on black for additive blending
function makeNebulaTexture(W = 1024, H = 512) {
  const fbm = makeNoise(321), c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, n = fbm(u * 6, v * 4, 5), m = fbm(u * 3 + 9, v * 2 + 4, 4);
    const band = Math.exp(-Math.pow((v - .5) * 4, 2));
    const k = Math.pow(Math.max(0, Math.min(1, n * 1.5 - .45)), 1.6) * (.25 + band * .9) * .55;
    img.data.set([(70 + 150 * m) * k, (40 + 60 * (1 - m)) * k, (150 + 90 * (1 - m)) * k, 255], (y * W + x) * 4);
  }
  ctx.putImageData(img, 0, 0); return new THREE.CanvasTexture(c);
}
