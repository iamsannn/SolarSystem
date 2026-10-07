/* background.js — parallax starfield + randomized shooting stars. */

// Three star layers. Layers follow the camera by different amounts, so nearer
// layers drift against farther ones as you move (parallax).
function createStarfield(scene, k = 1) {
  const layers = [
    { count: 2500, radius: 1800, size: 1.3, follow: 0.98 },
    { count: 1200, radius: 1200, size: 2.0, follow: 0.94 },
    { count: 400,  radius: 800,  size: 3.0, follow: 0.88 }
  ];
  const tints = [0xffffff, 0xcfdcff, 0xffe6c4];
  return layers.map(L => {
    const cnt = Math.floor(L.count * k);
    const pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3), c = new THREE.Color();
    for (let i = 0; i < cnt; i++) {
      // random point on a sphere shell
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([s * Math.cos(a) * L.radius, u * L.radius, s * Math.sin(a) * L.radius], i * 3);
      c.set(tints[Math.floor(Math.random() * 3)]).multiplyScalar(.5 + Math.random() * .5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: L.size, vertexColors: true, sizeAttenuation: false, depthWrite: false }));
    pts.userData.follow = L.follow; scene.add(pts); return pts;
  });
}
function updateStarfield(layers, camera, t = 0) {
  layers.forEach((l, i) => {
    l.position.copy(camera.position).multiplyScalar(l.userData.follow);
    if (!l.userData.noSpin) l.rotation.y = t * (0.0015 + i * 0.0012);          // very slow galaxy drift, nearer layers move a bit faster
  });
}

// Shooting stars: a 16-point tail that fades from bright head to nothing. Each streak
// eases in, glides (slowing slightly), and eases out, so it never pops on or off.
const TAIL = 16;
function createShootingStars(scene, poolSize = 5) {
  const pool = [];
  for (let i = 0; i < poolSize; i++) {
    const geo = new THREE.BufferGeometry(), col = new Float32Array(TAIL * 3);
    for (let j = 0; j < TAIL; j++) { const k = Math.pow(1 - j / (TAIL - 1), 1.6); col.set([k, k * .95, k * .9], j * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    line.visible = false; line.frustumCulled = false; scene.add(line);
    pool.push({ line, head: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1 });
  }
  return { pool, next: 1 };
}
function updateShootingStars(S, dt, camera) {
  S.next -= dt;
  if (S.next <= 0) {
    S.next = 2 + Math.random() * 6;
    const s = S.pool.find(p => p.life <= 0);
    if (s) {
      const dir = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      s.head.copy(camera.position).addScaledVector(dir, 500 + Math.random() * 300);
      s.vel.set(Math.random() - .5, -Math.random() * .6 - .2, Math.random() - .5).normalize().multiplyScalar(380 + Math.random() * 240);
      s.max = s.life = 1.2 + Math.random() * .8; s.line.visible = true;
    }
  }
  const p = new THREE.Vector3();
  S.pool.forEach(s => {
    if (s.life <= 0) return;
    s.life -= dt; const prog = Math.min(1, Math.max(0, 1 - s.life / s.max)), env = Math.sin(Math.PI * prog);
    s.head.addScaledVector(s.vel, dt * (1 - .4 * prog));
    const dir = s.vel.clone().normalize(), len = 70 * env, pos = s.line.geometry.attributes.position;
    for (let j = 0; j < TAIL; j++) { p.copy(s.head).addScaledVector(dir, -len * j / (TAIL - 1)); pos.setXYZ(j, p.x, p.y, p.z); }
    pos.needsUpdate = true; s.line.material.opacity = Math.pow(env, .7);
    if (s.life <= 0) s.line.visible = false;
  });
}

// Asteroid belt: 8 concentric bands (one InstancedMesh each). A band orbits as one piece at its own Kepler speed, so
// thousands of rocks glide smoothly at almost no CPU cost, and inner bands visibly outrun outer ones.
function createAsteroidBelt(scene, count = 2200, inner = 41.5, outer = 49, bandsN = 8) {
  const geo = new THREE.IcosahedronGeometry(1, 1), pos = geo.attributes.position, v = new THREE.Vector3(), nz = makeNoise(7);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); v.multiplyScalar(.7 + .6 * nz(v.x * 1.5 + 5, v.y * 1.5 + v.z * 2 + 5, 3)); pos.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, emissive: 0x2a2520 });   // faint emissive keeps rocks visible on their dark side
  const group = new THREE.Group(), bands = [], per = Math.ceil(count / bandsN), dummy = new THREE.Object3D(), col = new THREE.Color(), rnd = () => Math.random() * 6.283;
  for (let b = 0; b < bandsN; b++) {
    const r0 = inner + (outer - inner) * b / bandsN, r1 = inner + (outer - inner) * (b + 1) / bandsN, mesh = new THREE.InstancedMesh(geo, mat, per);
    for (let i = 0; i < per; i++) {
      const r = r0 + (r1 - r0) * Math.random(), a = rnd();
      dummy.position.set(Math.cos(a) * r, (Math.random() - .5) * 4.8 * (.4 + Math.random() * .6), Math.sin(a) * r);
      dummy.rotation.set(rnd(), rnd(), rnd()); dummy.scale.setScalar(.14 + Math.pow(Math.random(), 2.2) * .5); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col.setHSL(.06 + Math.random() * .06, .1 + Math.random() * .15, .42 + Math.random() * .3));
    }
    mesh.frustumCulled = false; group.add(mesh); bands.push({ mesh, w: Math.PI * 2 / (1680 * Math.pow((r0 + r1) / 2 / 47.5, 1.5)) });
  }
  scene.add(group); return { mesh: group, bands };
}
function updateAsteroidBelt(B, sim, orbitRate) { B.bands.forEach(b => b.mesh.rotation.y += sim * orbitRate * b.w); }

// Milky Way: ~16,000 tiny stars packed into a thin tilted band, dense and warm toward the "galactic centre".
// Returns { wrapper, spinner }: the wrapper holds the tilt, the spinner turns slowly along the band.
function createMilkyWay(scene, N = 16000) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), randn = () => (Math.random() + Math.random() + Math.random() - 1.5) / .75;
  for (let i = 0; i < N; i++) {
    let th, dens; do { th = (Math.random() * 2 - 1) * Math.PI; dens = .25 + .75 * Math.exp(-th * th / 1.1); } while (Math.random() > dens);
    const R = 1500 + Math.random() * 200, h = randn() * 38 * (.4 + dens);
    pos.set([Math.cos(th) * R, h, Math.sin(th) * R], i * 3);
    const b = (.25 + Math.random() * .75) * (.4 + dens * .8), w = dens;       // warm core, blue-white arms
    col.set([b * (.7 + .3 * w), b * (.8 + .1 * w), b * (1 - .25 * w)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const spinner = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
  const wrapper = new THREE.Group(); wrapper.rotation.set(.9, 0, .3); wrapper.add(spinner);
  wrapper.userData = { follow: 1, noSpin: true }; scene.add(wrapper); return { wrapper, spinner };
}

// ---- SVG artwork -> textures. Tries assets/<name>.svg first; falls back to the embedded copy in svgAssets.js.
const _svgCache = {};
function svgTexture(key, w, h) {
  if (_svgCache[key]) return _svgCache[key];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas); _svgCache[key] = tex;
  const paint = img => { canvas.getContext('2d').drawImage(img, 0, 0, w, h); tex.needsUpdate = true; };
  const fromData = () => { const i = new Image(); i.onload = () => paint(i); i.src = SVG_ASSETS[key]; };
  const img = new Image();
  img.onload = () => { try { const p = document.createElement('canvas').getContext('2d'); p.drawImage(img, 0, 0, 1, 1); p.getImageData(0, 0, 1, 1); paint(img); } catch (e) { fromData(); } };   // blocked by file:// ? use the embedded copy
  img.onerror = fromData; img.src = 'assets/' + SVG_FILES[key];
  return tex;
}

// Distant spiral + elliptical galaxies and far-off nebulae (SVG sprites, additive so they glow)
function createDistantGalaxies(scene, count = 8) {
  const group = new THREE.Group(), spiral = svgTexture('galaxySpiral', 256, 256), ell = svgTexture('galaxyElliptical', 256, 256), neb = svgTexture('nebula', 512, 512);
  const place = (tex, size, flat, opacity, R) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity, rotation: Math.random() * 6.28 }));
    const u = Math.random() * 2 - 1, a = Math.random() * 6.28, s = Math.sqrt(1 - u * u);
    sp.position.set(s * Math.cos(a) * R, u * R, s * Math.sin(a) * R); sp.scale.set(size, size * flat, 1); group.add(sp);
  };
  for (let i = 0; i < count; i++) place(i % 3 === 2 ? ell : spiral, 130 + Math.random() * 170, .35 + Math.random() * .6, .6 + Math.random() * .4, 1900);
  for (let i = 0; i < 4; i++) place(neb, 800 + Math.random() * 500, 1, .3 + Math.random() * .25, 2050);
  group.userData = { follow: .995 }; scene.add(group); return group;
}

// A real comet: elliptical orbit around the Sun, with its tail always pointing away from the Sun
const _cv = new THREE.Vector3(), _cs = new THREE.Vector3(), _cn = new THREE.Vector3();
function createComet(scene) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: svgTexture('comet', 512, 128), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  scene.add(sprite); return { sprite, M0: 1.3, eul: new THREE.Euler(.45, .7, 0) };
}
function updateComet(C, simDays, camera) {
  const a = 100, e = .85, b = a * Math.sqrt(1 - e * e), M = C.M0 + Math.PI * 2 * simDays / 7000; let E = M;
  for (let i = 0; i < 5; i++) E = M + e * Math.sin(E);                                  // solve Kepler's equation
  _cv.set(a * (Math.cos(E) - e), 0, b * Math.sin(E)).applyEuler(C.eul); C.sprite.position.copy(_cv);
  const tail = Math.min(90, Math.max(16, 900 / _cv.length())); C.sprite.scale.set(tail * 2, tail * .5, 1);   // tail grows near the Sun
  camera.updateMatrixWorld(); _cs.set(0, 0, 0).project(camera); _cn.copy(_cv).project(camera);
  C.sprite.material.rotation = Math.atan2((_cn.y - _cs.y) * innerHeight, (_cn.x - _cs.x) * innerWidth);
}

// A small satellite circling Earth on a tilted orbit
function createSatellite(earthPivot, earthRadius) {
  const tilt = new THREE.Group(), spinner = new THREE.Group(); tilt.rotation.z = .9; tilt.add(spinner); earthPivot.add(tilt);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: svgTexture('satellite', 128, 128), transparent: true, depthWrite: false }));
  sp.position.x = earthRadius * 1.5; sp.scale.set(1.1, 1.1, 1); spinner.add(sp); return { spinner };
}
function updateSatellite(S, dtScaled) { S.spinner.rotation.y += dtScaled * Math.PI * 2 / 10; }
