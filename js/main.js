/* main.js — scene, planets + moons, time simulation, NASA-Eyes-style UI. */

// ---------- Renderer, camera, controls ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
document.getElementById('scene').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 4000);
const HOME = new THREE.Vector3(0, 110, 190); camera.position.copy(HOME);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 1; controls.maxDistance = 600;
scene.add(new THREE.AmbientLight(0x1a2033, 0.9));
scene.add(new THREE.PointLight(0xffffff, 1.6, 0));            // the Sun lights everything

// ---------- Sun + glow ----------
const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 64), new THREE.MeshBasicMaterial({ map: makeSunTexture() }));
sun.userData = { ...SUN_INFO, radius: 9 }; scene.add(sun);
function makeAtmosphere(radius, color, power = 2.2, scale = 1.12) {   // fresnel rim glow
  return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 48, 48), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(...color) }, p: { value: power } },
    vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 c; uniform float p; varying vec3 n; void main(){ float i = pow(max(0.,0.72-dot(n,vec3(0.,0.,1.))),p); gl_FragColor = vec4(c,1.)*i*2.2; }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
}
scene.add(makeAtmosphere(9, [1, .6, .15], 1.6, 1.35));

// ---------- Planets and their moons ----------
const bodies = [], pickables = [sun], moonRings = [], fmt = n => n.toLocaleString('en-US');
const orbitLines = new THREE.Group(); scene.add(orbitLines);
const circle = (r, color, op) => { const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
let moonSeed = 20;

PLANETS.forEach(p => {
  const pivot = new THREE.Group(), tilt = new THREE.Group();
  tilt.rotation.z = THREE.MathUtils.degToRad(p.tilt);
  const tex = makePlanetTextures(p);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 64, 64),
    new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: p.bump, roughness: .95 }));
  mesh.userData = p; tilt.add(mesh); pivot.add(tilt);
  if (p.atmo) tilt.add(makeAtmosphere(p.radius, p.atmo));
  if (p.ring) {                                                   // Saturn's ring
    const inner = p.radius * 1.35, outer = p.radius * 2.4, geo = new THREE.RingGeometry(inner, outer, 128), pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - inner) / (outer - inner), .5); }
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: makeRingTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; tilt.add(ring);
  }
  // Moons: each rides on its own pivot that turns around the planet
  p.moonList = p.moons.map(md => {
    const mt = makePlanetTextures({ palette: md.c, seed: moonSeed++, bands: 0 }, 256, 128), orbitR = md.m * p.radius;
    const mm = new THREE.Mesh(new THREE.SphereGeometry(md.r, 32, 32), new THREE.MeshStandardMaterial({ map: mt.map, bumpMap: mt.bump, bumpScale: .6, roughness: 1 }));
    mm.position.x = orbitR;
    mm.userData = { name: md.n, radius: md.r, fact: md.f, parent: p, isMoon: true, stats: { Diameter: fmt(md.km) + ' km',
      'Orbit period': Math.abs(md.d) + ' days' + (md.d < 0 ? ' (backwards)' : ''), ['Distance from ' + p.name]: fmt(md.dk) + ' km', Parent: p.name } };
    const mp = new THREE.Group(); mp.rotation.y = Math.random() * 6.28; mp.add(mm); pivot.add(mp);
    const ring = circle(orbitR, 0x9fb4ff, .14); pivot.add(ring); moonRings.push(ring); pickables.push(mm);
    return { d: md.d, pivot: mp, mesh: mm };
  });
  p.viewDist = Math.max(p.radius * 4.5 + 4, p.moons.length ? Math.max(...p.moons.map(m => m.m)) * p.radius * 1.8 : 0);   // camera distance that frames all moons
  orbitLines.add(circle(p.distance, 0x8aa4ff, .16));
  p.pivot = pivot; p.mesh = mesh; p.L0r = THREE.MathUtils.degToRad(p.L0);
  scene.add(pivot); pickables.push(mesh); bodies.push(p);
});

// ---------- Universe: stars, Milky Way, nebula, galaxies, belt ----------
const starLayers = createStarfield(scene);
starLayers.push(createDistantGalaxies(scene));
const milkyWay = createMilkyWay(scene); starLayers.push(milkyWay.wrapper);
const shooting = createShootingStars(scene);
const nebulaTilt = new THREE.Group(); nebulaTilt.rotation.set(.9, 0, .3);      // same tilt as the Milky Way band
const nebula = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.MeshBasicMaterial({
  map: makeNebulaTexture(), side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
nebula.renderOrder = -2; nebulaTilt.add(nebula); scene.add(nebulaTilt);
const belt = createAsteroidBelt(scene);

// ---------- Time (real dates) ----------
// Planets sit at their approximate real positions for the simulated date. Rates are in days of
// simulated time per real second. Spin and moon motion use a gentler, capped speed so they never blur.
const J2000 = Date.UTC(2000, 0, 1, 12), nowDays = () => (Date.now() - J2000) / 864e5;
const RATES = [-365, -100, -30, -10, -3, -1, -1/24, -1/1440, 1/86400, 1/1440, 1/24, 1, 3, 10, 30, 100, 365];
let simDays = nowDays(), rateIdx = 13, paused = false;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), SPIN_RATE = 4;
function rateLabel(r) {
  const a = Math.abs(r), s = r < 0 ? '−' : '';
  if (a < 1e-4) return s + 'Real time'; if (a < 1e-3) return s + '1 min / sec'; if (a < .05) return s + '1 hr / sec';
  return s + (a >= 365 ? '1 yr' : a + (a > 1 ? ' days' : ' day')) + ' / sec';
}

// ---------- Focus / camera fly-to ----------
let focus = null, fly = null; const prevPos = new THREE.Vector3(), HOMEV = new THREE.Vector3();
const ease = t => 1 - Math.pow(1 - t, 3), worldPos = o => o.getWorldPosition(new THREE.Vector3());
function focusOn(obj) {
  focus = obj; const d = obj.userData, p = worldPos(obj);
  const dir = camera.position.clone().sub(p).normalize().multiplyScalar(d.viewDist || d.radius * 4.5 + 4);
  fly = { t: 0, from: camera.position.clone(), offset: dir.add(new THREE.Vector3(0, d.radius * .8, 0)), fromTarget: controls.target.clone() };
  prevPos.copy(p); showInfo(d); markActive(obj);
}
function goHome() { focus = null; fly = { t: 0, from: camera.position.clone(), fromTarget: controls.target.clone(), home: true }; hideInfo(); markActive(null); }

// ---------- Info panel ----------
const info = document.getElementById('info');
function showInfo(d) {
  document.getElementById('info-name').textContent = d.name; document.getElementById('info-fact').textContent = d.fact;
  document.getElementById('info-stats').innerHTML = Object.entries(d.stats).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join(''); info.classList.add('open');
}
function hideInfo() { info.classList.remove('open'); }

// ---------- Left menu: search + Sun / planets / moons ----------
const menu = document.getElementById('menu'), list = document.getElementById('menu-list'), entries = [], groups = [];
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
function addItem(parent, obj, cls) { const b = el('button', cls, obj.userData.name); b.onclick = () => focusOn(obj); parent.appendChild(b); const e = { obj, b, name: obj.userData.name.toLowerCase() }; entries.push(e); return e; }
const sunRow = el('div', 'row'); list.appendChild(sunRow); addItem(sunRow, sun, 'item');
bodies.forEach(p => {
  const wrap = el('div'), row = el('div', 'row'), sub = el('div', 'sub'), pe = addItem(row, p.mesh, 'item');
  const moons = p.moonList.map(m => addItem(sub, m.mesh, 'moon')); let chev = null;
  if (moons.length) { chev = el('button', 'chev', '▸'); chev.setAttribute('aria-label', 'Show moons of ' + p.name); chev.onclick = () => { sub.classList.toggle('open'); chev.classList.toggle('open'); }; row.appendChild(chev); }
  wrap.append(row, sub); list.appendChild(wrap); groups.push({ wrap, sub, chev, pe, moons });
});
const navBtns = [];
function markActive(obj) {
  entries.forEach(e => e.b.classList.toggle('active', e.obj === obj));
  navBtns.forEach(n => n.b.classList.toggle('active', !!obj && (n.obj === obj || obj.userData.parent === n.obj.userData)));
  moonBtns.forEach(n => n.b.classList.toggle('active', n.obj === obj));
}

// ---------- Horizontal planet row with moon dropdowns ----------
const planetNav = document.getElementById('planet-nav'), moonMenu = document.getElementById('moon-menu'), moonBtns = []; let openFor = null;
function closeMoonMenu() { moonMenu.classList.remove('open'); openFor = null; }
function openMoonMenu(p, anchor) {
  moonMenu.innerHTML = ''; moonMenu.appendChild(el('div', 'hd', p.name.toUpperCase() + ' · MOONS')); moonBtns.length = 0;
  p.moonList.forEach(m => { const b = el('button', '', m.mesh.userData.name); b.setAttribute('role', 'menuitem'); b.onclick = () => { focusOn(m.mesh); closeMoonMenu(); }; moonMenu.appendChild(b); moonBtns.push({ obj: m.mesh, b }); });
  const r = anchor.getBoundingClientRect(); moonMenu.classList.add('open'); openFor = p;
  moonMenu.style.left = Math.max(8, Math.min(r.left, innerWidth - moonMenu.offsetWidth - 8)) + 'px'; moonMenu.style.top = r.bottom + 16 + 'px';
}
[sun, ...bodies.map(b => b.mesh)].forEach(o => {
  const p = o.userData, hasMoons = !!(p.moonList && p.moonList.length), b = el('button', '', p.name);
  if (hasMoons) b.appendChild(el('span', 'caret', '▾'));
  b.onclick = e => { e.stopPropagation(); focusOn(o); if (hasMoons && openFor !== p) openMoonMenu(p, b); else closeMoonMenu(); };
  planetNav.appendChild(b); navBtns.push({ obj: o, b });
});
document.addEventListener('click', e => { if (!moonMenu.contains(e.target)) closeMoonMenu(); });
planetNav.addEventListener('scroll', closeMoonMenu);
document.getElementById('search').oninput = e => {
  const q = e.target.value.trim().toLowerCase();
  sunRow.style.display = !q || 'sun'.includes(q) ? '' : 'none';
  groups.forEach(g => {
    const anyMoon = g.moons.some(m => m.name.includes(q)), show = !q || g.pe.name.includes(q) || anyMoon;
    g.wrap.style.display = show ? '' : 'none';
    g.moons.forEach(m => m.b.style.display = !q || m.name.includes(q) || g.pe.name.includes(q) ? '' : 'none');
    if (q && g.chev) { g.sub.classList.toggle('open', anyMoon); g.chev.classList.toggle('open', anyMoon); }
  });
};
const menuBtn = document.getElementById('menu-btn');
menuBtn.onclick = () => { const o = menu.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); };

// ---------- Labels (planets, Sun, moons) ----------
const labelLayer = document.getElementById('labels'), labelV = new THREE.Vector3();
const labelItems = [sun, ...bodies.map(b => b.mesh), ...bodies.flatMap(b => b.moonList.map(m => m.mesh))].map(m => {
  const e = el('div', 'label' + (m.userData.isMoon ? ' moon' : ''), m.userData.name); labelLayer.appendChild(e); return { m, e };
});
function updateLabels() {
  if (labelLayer.classList.contains('off')) return;
  camera.updateMatrixWorld();
  labelItems.forEach(({ m, e }) => {
    m.getWorldPosition(labelV); const par = m.userData.parent;
    const near = !par || camera.position.distanceTo(par.pivot.position) < par.viewDist * 2.5;    // moon labels appear when you are close to their planet
    labelV.y += m.userData.radius * 1.25 + .5; labelV.project(camera);
    e.style.opacity = near && labelV.z < 1 ? 1 : 0;
    e.style.transform = `translate(${(labelV.x * .5 + .5) * innerWidth}px, ${(-labelV.y * .5 + .5) * innerHeight}px) translate(-50%, -100%)`;
  });
}

// ---------- Controls ----------
const $ = id => document.getElementById(id), clockDate = $('clock-date'), clockRate = $('clock-rate');
const toggle = (id, fn) => $(id).onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); fn(on); };
toggle('btn-orbits', on => { orbitLines.visible = on; moonRings.forEach(r => r.visible = on); });
toggle('btn-labels', on => labelLayer.classList.toggle('off', !on));
toggle('btn-belt', on => belt.mesh.visible = on);
$('btn-home').onclick = $('info-close').onclick = goHome;
$('rate-down').onclick = () => rateIdx = Math.max(0, rateIdx - 1);
$('rate-up').onclick = () => rateIdx = Math.min(RATES.length - 1, rateIdx + 1);
$('btn-now').onclick = () => { simDays = nowDays(); rateIdx = 8; paused = false; $('btn-pause').textContent = 'Pause'; };   // real time, right now
$('btn-pause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Play' : 'Pause'; };
$('ctl-toggle').onclick = e => {
  const hidden = $('controls').classList.toggle('hidden'); e.target.textContent = hidden ? 'Show controls' : 'Hide controls'; e.target.setAttribute('aria-expanded', !hidden);
};
addEventListener('keydown', e => { if (e.key === 'Escape') { closeMoonMenu(); goHome(); } });

// ---------- Picking ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('tooltip'); let downAt = null;
function pick(e) { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(pickables)[0]; return h && h.object; }
renderer.domElement.addEventListener('pointermove', e => {
  const o = pick(e); tip.style.opacity = o ? 1 : 0; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
  if (o) tip.textContent = o.userData.name; renderer.domElement.style.cursor = o ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; const o = pick(e); if (o) focusOn(o); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- Animation loop ----------
const clock = new THREE.Clock(); let lastClock = '';
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .1), rate = RATES[rateIdx], dDays = paused ? 0 : rate * dt, f = paused ? 0 : clamp(rate / 10, -4, 4);
  simDays += dDays;

  sun.rotation.y += f * dt * .05;
  bodies.forEach(p => {
    const a = p.L0r + Math.PI * 2 * simDays / p.orbitDays;                       // real-date orbital position
    p.pivot.position.set(Math.cos(a) * p.distance, 0, -Math.sin(a) * p.distance);
    p.mesh.rotation.y += f * dt * SPIN_RATE * Math.PI * 2 / p.spinHours;         // spin on axis
    p.moonList.forEach(m => m.pivot.rotation.y += f * dt * Math.sign(m.d) * Math.PI * 2 / (4 * Math.pow(Math.abs(m.d), .6)));   // moons: real order, compressed time
  });
  updateAsteroidBelt(belt, dDays, 1);

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.6); const k = ease(fly.t);
    if (fly.home) { camera.position.lerpVectors(fly.from, HOME, k); controls.target.lerpVectors(fly.fromTarget, HOMEV, k); }
    else { const p = worldPos(focus); camera.position.lerpVectors(fly.from, p.clone().add(fly.offset), k); controls.target.lerpVectors(fly.fromTarget, p, k); }
    if (fly.t >= 1) { if (!fly.home) prevPos.copy(worldPos(focus)); fly = null; }
  } else if (focus) {                                                            // follow the focused body
    const p = worldPos(focus); camera.position.add(p.clone().sub(prevPos)); controls.target.copy(p); prevPos.copy(p);
  }

  controls.update();
  updateStarfield(starLayers, camera, clock.elapsedTime);
  nebulaTilt.position.copy(camera.position); nebula.rotation.y += dt * .004; milkyWay.spinner.rotation.y += dt * .004;
  updateShootingStars(shooting, dt, camera);

  const txt = new Date(J2000 + simDays * 864e5).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const rl = paused ? 'Paused' : rateLabel(rate);
  if (txt + rl !== lastClock) { clockDate.textContent = txt; clockRate.textContent = rl; lastClock = txt + rl; }
  updateLabels(); renderer.render(scene, camera);
}
animate();
$('loader').classList.add('done');
