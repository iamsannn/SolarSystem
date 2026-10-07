// Built inside init() so the loading screen paints before heavy texture generation starts.
function init() {
/* main.js — scene, planets + moons, time simulation, NASA-Eyes-style UI. */

// ---------- Renderer, camera, controls ----------
// Quality profile: phones get lighter geometry, smaller textures and fewer particles
const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const Q = isMobile ? { dpr: 1.5, seg: 32, tex: [512, 256], moonTex: [128, 64], sunTex: [512, 256], stars: .4, belt: 1000, mw: 6000, shoot: 3 }
                   : { dpr: 2, seg: 64, tex: [1024, 512], moonTex: [256, 128], sunTex: [1024, 512], stars: 1, belt: 2200, mw: 16000, shoot: 5 };
const narrow = () => innerWidth <= 820;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let dpr = Math.min(devicePixelRatio, Q.dpr); renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
document.getElementById('scene').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 4000);
// Home view: pull the camera back on tall (portrait) screens so the whole system fits
const HOME_BASE = new THREE.Vector3(0, 110, 190), HOME = HOME_BASE.clone();
function fitHome() { HOME.copy(HOME_BASE).multiplyScalar(Math.min(2.7, Math.max(1, 1.1 / camera.aspect))); }
fitHome(); camera.position.copy(HOME);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 1; controls.maxDistance = 600;
scene.add(new THREE.AmbientLight(0x1a2033, 0.9));
scene.add(new THREE.PointLight(0xffffff, 1.6, 0));            // the Sun lights everything

// ---------- Sun + glow ----------
const sun = new THREE.Mesh(new THREE.SphereGeometry(9, Q.seg, Q.seg), new THREE.MeshBasicMaterial({ map: makeSunTexture(...Q.sunTex) }));
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
  const tex = makePlanetTextures(p, ...Q.tex);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, Q.seg, Q.seg),
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
    const mt = makePlanetTextures({ palette: md.c, seed: moonSeed++, bands: 0 }, ...Q.moonTex), orbitR = md.m * p.radius;
    const mm = new THREE.Mesh(new THREE.SphereGeometry(md.r, Math.min(32, Q.seg), Math.min(32, Q.seg)), new THREE.MeshStandardMaterial({ map: mt.map, bumpMap: mt.bump, bumpScale: .6, roughness: 1 }));
    mm.position.x = orbitR;
    mm.userData = { name: md.n, radius: md.r, fact: md.f, parent: p, isMoon: true, stats: { Diameter: fmt(md.km) + ' km',
      'Orbit period': Math.abs(md.d) + ' days' + (md.d < 0 ? ' (backwards)' : ''), Distance: fmt(md.dk) + ' km', Parent: p.name }, extra: { Radius: fmt(Math.round(md.km / 2)) + ' km', Direction: md.d < 0 ? 'Retrograde' : 'Prograde', Orbits: p.name } };
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
const starLayers = createStarfield(scene, Q.stars);
starLayers.push(createDistantGalaxies(scene));
const milkyWay = createMilkyWay(scene, Q.mw); starLayers.push(milkyWay.wrapper);
const shooting = createShootingStars(scene, Q.shoot);
const nebulaTilt = new THREE.Group(); nebulaTilt.rotation.set(.9, 0, .3);      // same tilt as the Milky Way band
const nebula = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.MeshBasicMaterial({
  map: makeNebulaTexture(...Q.sunTex), side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
nebula.renderOrder = -2; nebulaTilt.add(nebula); scene.add(nebulaTilt);
const belt = createAsteroidBelt(scene, Q.belt);
const comet = createComet(scene);
const earthBody = bodies.find(b => b.name === 'Earth'), satellite = createSatellite(earthBody.pivot, earthBody.radius);

// ---------- Time (real dates) ----------
// Planets sit at their approximate real positions for the simulated date. Rates are in days of
// simulated time per real second. Spin and moon motion use a gentler, capped speed so they never blur.
const J2000 = Date.UTC(2000, 0, 1, 12), nowDays = () => (Date.now() - J2000) / 864e5;
const RATES = [1/86400, 1/1440, 1/24, 1, 3, 10, 30, 100, 365];
let simDays = nowDays(), rateIdx = 5, paused = false;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), SPIN_RATE = 4;
function rateLabel(r) {
  const a = Math.abs(r), s = r < 0 ? '−' : '';
  if (a < 1e-4) return s + 'Real time'; if (a < 1e-3) return s + '1 min / sec'; if (a < .05) return s + '1 hr / sec';
  return s + (a >= 365 ? '1 yr' : a + (a > 1 ? ' days' : ' day')) + ' / sec';
}

// ---------- Focus / camera fly-to ----------
let focus = null, fly = null; const prevPos = new THREE.Vector3(), HOMEV = new THREE.Vector3();
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, worldPos = o => o.getWorldPosition(new THREE.Vector3());
function focusOn(obj) {
  if (narrow()) { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  focus = obj; const d = obj.userData, p = worldPos(obj);
  const dir = camera.position.clone().sub(p).normalize().multiplyScalar(d.viewDist || d.radius * 4.5 + 4);
  fly = { t: 0, dur: clamp(camera.position.distanceTo(p) / 100, 1.1, 2.4), from: camera.position.clone(), offset: dir.add(new THREE.Vector3(0, d.radius * .8, 0)), fromTarget: controls.target.clone() };
  prevPos.copy(p); showInfo(d); markActive(obj);
}
function goHome() { focus = null; fly = { t: 0, from: camera.position.clone(), fromTarget: controls.target.clone(), home: true }; hideInfo(); markActive(null); }

// ---------- Info panel ----------
const info = document.getElementById('info');
let pendingInfo = false;
const rows = o => Object.entries(o || {}).map(([k, v]) => `<div${k === 'Major moons' ? ' class="wide"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('');
function showInfo(d) {                       // fills the box; it appears next to the planet once the camera has nearly arrived
  const g = id => document.getElementById(id);
  info.classList.remove('open'); info._mode = null;
  g('info-name').textContent = d.name; g('info-fact').textContent = d.fact;
  g('info-stats').innerHTML = rows(d.stats); g('info-extra').innerHTML = rows(d.extra);
  g('info-more').hidden = true; g('info-toggle').textContent = 'More details ▾'; g('info-toggle').style.display = d.extra ? '' : 'none';
  pendingInfo = true;
}
function hideInfo() { info.classList.remove('open'); pendingInfo = false; }

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
  const act = navBtns.find(n => n.b.classList.contains('active'));
  if (act) act.b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });   // keep the current planet visible in the strip
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
let lblTick = 0;
function updateLabels() {
  if (labelLayer.classList.contains('off')) return;
  camera.updateMatrixWorld();
  labelItems.forEach(({ m, e }) => {
    m.getWorldPosition(labelV); const par = m.userData.parent;
    const near = !par || camera.position.distanceTo(par.pivot.position) < par.viewDist * 2.5;    // moon labels appear when you are close to their planet
    labelV.y += m.userData.radius * 1.25 + .5; labelV.project(camera);
    const o = near && labelV.z < 1 ? 1 : 0; if (e._o !== o) { e.style.opacity = o; e._o = o; }
    e.style.transform = `translate(${(labelV.x * .5 + .5) * innerWidth}px, ${(-labelV.y * .5 + .5) * innerHeight}px) translate(-50%, -100%)`;
  });
}

// ---------- Controls ----------
const $ = id => document.getElementById(id), clockRate = $('clock-rate');
const toggle = (id, fn) => $(id).onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); fn(on); };
toggle('btn-orbits', on => { orbitLines.visible = on; moonRings.forEach(r => r.visible = on); });
toggle('btn-labels', on => labelLayer.classList.toggle('off', !on));
toggle('btn-belt', on => belt.mesh.visible = on);
$('btn-home').onclick = $('info-close').onclick = goHome;
$('info-toggle').onclick = e => { const more = $('info-more'); more.hidden = !more.hidden; e.currentTarget.textContent = more.hidden ? 'More details ▾' : 'Fewer details ▴'; };
const updateRate = () => clockRate.textContent = rateLabel(RATES[rateIdx]);
$('rate-down').onclick = () => { rateIdx = Math.max(0, rateIdx - 1); updateRate(); };
$('rate-up').onclick = () => { rateIdx = Math.min(RATES.length - 1, rateIdx + 1); updateRate(); };
updateRate();
// Show / hide the control panel: remembers your choice, starts hidden on phones, swipe down to hide / up to show, key C
const ctlBtn = $('ctl-toggle'), ctlDock = $('controls');
function setControls(show, save = true) {
  ctlDock.classList.toggle('hidden', !show); ctlBtn.setAttribute('aria-expanded', show);
  ctlBtn.innerHTML = show ? '<span class="chev">⌄</span> Hide' : '<span class="chev">⌃</span> Controls';
  if (save) try { localStorage.setItem('ss-controls', show ? 'shown' : 'hidden'); } catch (err) {}
}
let savedCtl = null; try { savedCtl = localStorage.getItem('ss-controls'); } catch (err) {}
setControls(savedCtl ? savedCtl === 'shown' : !isMobile, false);
ctlBtn.onclick = () => setControls(ctlDock.classList.contains('hidden'));
let swipeY = 0;
const swipe = (node, dir) => { node.addEventListener('touchstart', e => swipeY = e.touches[0].clientY, { passive: true });
  node.addEventListener('touchend', e => { if ((e.changedTouches[0].clientY - swipeY) * dir > 40) setControls(dir < 0); }); };
swipe(ctlDock, 1); swipe(ctlBtn.parentNode, -1);
addEventListener('keydown', e => { if ((e.key === 'c' || e.key === 'C') && e.target.tagName !== 'INPUT') setControls(ctlDock.classList.contains('hidden')); });
addEventListener('keydown', e => { if (e.key === 'Escape') { closeMoonMenu(); goHome(); } });

// ---------- Picking ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('tooltip'); let downAt = null;
function pick(e) { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(pickables)[0]; return h && h.object; }
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const o = pick(e); tip.style.opacity = o ? 1 : 0; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
  if (o) tip.textContent = o.userData.name; renderer.domElement.style.cursor = o ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerdown', e => { downAt = e.isPrimary ? [e.clientX, e.clientY] : null; });
renderer.domElement.addEventListener('pointerup', e => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; const o = pick(e); if (o) focusOn(o); });
addEventListener('resize', () => {
  const old = HOME.clone(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  fitHome(); if (!focus && !fly && camera.position.distanceTo(old) < 2) camera.position.copy(HOME);   // re-frame when rotating the phone
  closeMoonMenu();
});

// ---------- Animation loop ----------
// ---------- Detail box: a small callout that sits beside the selected planet, never on top of it ----------
const _ic = new THREE.Vector3(), _ir = new THREE.Vector3(), _ip = new THREE.Vector3(), _tb = document.querySelector('.topbar'), _cp = $('controls').firstElementChild, _ct = $('ctl-toggle');
function placeInfo() {
  if (!focus) return;
  if (pendingInfo && (!fly || fly.t > .55)) { info.classList.add('open'); pendingInfo = false; }
  if (!info.classList.contains('open')) return;
  camera.updateMatrixWorld();
  focus.getWorldPosition(_ip); _ic.copy(_ip).project(camera);
  const e = camera.matrixWorld.elements; _ir.set(e[0], e[1], e[2]).multiplyScalar(focus.userData.radius).add(_ip).project(camera);   // a point one radius to the side = on-screen size
  const vw = innerWidth, vh = innerHeight, px = (_ic.x * .5 + .5) * vw, py = (-_ic.y * .5 + .5) * vh, R = Math.max(8, Math.abs((_ir.x - _ic.x) * .5 * vw));
  const w = info.offsetWidth, h = info.offsetHeight, gap = 14, mg = 8, top = _tb.getBoundingClientRect().bottom + 8;
  const bot = (ctlDock.classList.contains('hidden') ? _ct : _cp).getBoundingClientRect().top - 8;
  const cx = clamp(px - w / 2, mg, vw - w - mg), cy = clamp(py - h / 2, top, Math.max(top, bot - h));
  const cand = { r: () => ({ x: px + R + gap, y: cy, ok: px + R + gap + w <= vw - mg }), l: () => ({ x: px - R - gap - w, y: cy, ok: px - R - gap - w >= mg }),
                 b: () => ({ x: cx, y: py + R + gap, ok: py + R + gap + h <= bot }), t: () => ({ x: cx, y: py - R - gap - h, ok: py - R - gap - h >= top }) };
  const order = vw < vh ? ['b', 't', 'r', 'l'] : ['r', 'l', 'b', 't'];   // tall phone screens: below/above first; wide screens: sideways first
  if (info._mode) order.unshift(info._mode);                              // keep the current side unless it stops fitting (no flicker)
  let pick = null; for (const k of order) { const c = cand[k](); if (c.ok) { pick = c; info._mode = k; break; } }
  if (!pick) pick = cand[order[0]]();
  info.style.transform = `translate3d(${Math.round(clamp(pick.x, mg, vw - w - mg))}px, ${Math.round(clamp(pick.y, top, vh - h - mg))}px, 0)`;
}
const clock = new THREE.Clock(); let sdt = 1 / 60, perfT = 0, perfN = 0; const _p = new THREE.Vector3(), _d = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const raw = Math.min(clock.getDelta(), .1); sdt += (raw - sdt) * .25; const dt = sdt, rate = RATES[rateIdx], dDays = paused ? 0 : rate * dt, f = paused ? 0 : clamp(rate / 10, -4, 4);
  simDays += dDays;
  // Adaptive resolution: if the device struggles, quietly lower the render resolution
  if (clock.elapsedTime > 3 && ++perfN && (perfT += dt) && perfN === 90) {
    if (perfT / perfN > 1 / 42 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight); }
    perfT = perfN = 0;
  }

  sun.rotation.y += f * dt * .05;
  bodies.forEach(p => {
    const a = p.L0r + Math.PI * 2 * simDays / p.orbitDays;                       // real-date orbital position
    p.pivot.position.set(Math.cos(a) * p.distance, 0, -Math.sin(a) * p.distance);
    p.mesh.rotation.y += f * dt * SPIN_RATE * Math.PI * 2 / p.spinHours;         // spin on axis
    p.moonList.forEach(m => m.pivot.rotation.y += f * dt * Math.sign(m.d) * Math.PI * 2 / (4 * Math.pow(Math.abs(m.d), .6)));   // moons: real order, compressed time
  });
  if (belt.mesh.visible) updateAsteroidBelt(belt, dDays, 1);

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / (fly.dur || 1.6)); const k = ease(fly.t);
    if (fly.home) { camera.position.lerpVectors(fly.from, HOME, k); controls.target.lerpVectors(fly.fromTarget, HOMEV, k); }
    else { const p = worldPos(focus); camera.position.lerpVectors(fly.from, p.clone().add(fly.offset), k); controls.target.lerpVectors(fly.fromTarget, p, k); }
    if (fly.t >= 1) { if (!fly.home) prevPos.copy(worldPos(focus)); fly = null; }
  } else if (focus) {                                                            // follow the focused body
    focus.getWorldPosition(_p); camera.position.add(_d.copy(_p).sub(prevPos)); controls.target.copy(_p); prevPos.copy(_p);
  }

  controls.update();
  updateSatellite(satellite, f * dt); updateComet(comet, simDays, camera);
  placeInfo();
  updateStarfield(starLayers, camera, clock.elapsedTime);
  nebulaTilt.position.copy(camera.position); nebula.rotation.y += dt * .004; milkyWay.spinner.rotation.y += dt * .004;
  updateShootingStars(shooting, dt, camera);

  updateLabels(); renderer.render(scene, camera);
}
animate();
$('loader').classList.add('done');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {            // gentle intro: glide out to the full view
  camera.position.copy(HOME).multiplyScalar(.55).add(new THREE.Vector3(-60, -20, 0));
  fly = { t: 0, dur: 4, from: camera.position.clone(), fromTarget: controls.target.clone(), home: true };
}

}
requestAnimationFrame(() => setTimeout(init, 40));
