/* main.js — builds the scene, runs the animation loop, handles interaction. */

// ---------- Renderer, camera, controls ----------
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);
const HOME = new THREE.Vector3(0, 110, 190);
camera.position.copy(HOME);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.minDistance = 3; controls.maxDistance = 600;

// ---------- Lighting ----------
scene.add(new THREE.AmbientLight(0x1a2033, 0.9));
scene.add(new THREE.PointLight(0xffffff, 1.6, 0));     // the Sun lights everything from the origin

// ---------- Sun (textured sphere + additive glow shell) ----------
const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 64), new THREE.MeshBasicMaterial({ map: makeSunTexture() }));
sun.userData = { ...SUN_INFO, radius: 9, isSun: true };
scene.add(sun);

// Fresnel rim glow: brightest at the silhouette. Used for the Sun and planet atmospheres.
function makeAtmosphere(radius, color, power = 2.2, scale = 1.12) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 48, 48), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(...color) }, p: { value: power } },
    vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 c; uniform float p; varying vec3 n; void main(){ float i = pow(max(0.,0.72-dot(n,vec3(0.,0.,1.))),p); gl_FragColor = vec4(c,1.)*i*2.2; }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }));
}
scene.add(makeAtmosphere(9, [1, .6, .15], 1.6, 1.35));

// ---------- Planets ----------
const bodies = [];                 // everything clickable (planets + sun)
const pickables = [sun];
const orbitLines = new THREE.Group(); scene.add(orbitLines);

PLANETS.forEach(p => {
  const pivot = new THREE.Group();                          // moves around the Sun
  const tilt = new THREE.Group(); tilt.rotation.z = THREE.MathUtils.degToRad(p.tilt); // axial tilt
  const tex = makePlanetTextures(p);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 64, 64),
    new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: p.bump, roughness: .95, metalness: 0 }));
  mesh.userData = p;
  tilt.add(mesh); pivot.add(tilt);
  if (p.atmo) tilt.add(makeAtmosphere(p.radius, p.atmo));

  if (p.ring) {                                             // Saturn's ring with radial UVs
    const inner = p.radius * 1.35, outer = p.radius * 2.4;
    const geo = new THREE.RingGeometry(inner, outer, 128), pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - inner) / (outer - inner), .5); }
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: makeRingTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; tilt.add(ring);
  }

  if (p.moon) {                                             // Earth's Moon
    const moonPivot = new THREE.Group();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(p.moon.radius, 32, 32),
      new THREE.MeshStandardMaterial({ map: makePlanetTextures({ palette: [[0,[70,70,70]],[1,[190,190,190]]], seed: 11, bands: 0 }, 512, 256).map, roughness: 1 }));
    moon.position.x = p.moon.distance; moonPivot.add(moon); pivot.add(moonPivot);
    p.moonPivot = moonPivot;
  }

  // Visible orbit path
  const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * p.distance, 0, Math.sin(a) * p.distance)); }
  orbitLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8aa4ff, transparent: true, opacity: .16 })));

  p.pivot = pivot; p.mesh = mesh; p.angle = Math.random() * Math.PI * 2;
  scene.add(pivot); pickables.push(mesh); bodies.push(p);
});

// ---------- Background ----------
const starLayers = createStarfield(scene);
const shooting = createShootingStars(scene);

// ---------- Simulation speed ----------
// 1x = one Earth year in 40 s; one Earth day in 6 s. Periods keep real ratios.
const ORBIT_RATE = 365.25 / 40, SPIN_RATE = 24 / 6;
let speed = 1, paused = false;

// ---------- Focus / camera fly-to ----------
let focus = null, fly = null;
const prevPos = new THREE.Vector3();
const ease = t => 1 - Math.pow(1 - t, 3);
const worldPos = o => o.getWorldPosition(new THREE.Vector3());

function focusOn(obj) {
  focus = obj; const r = obj.userData.radius;
  const from = camera.position.clone(), p = worldPos(obj);
  const dir = camera.position.clone().sub(p).normalize().multiplyScalar(r * 4.5 + 4);
  fly = { t: 0, from, offset: dir.add(new THREE.Vector3(0, r * .8, 0)), fromTarget: controls.target.clone() };
  prevPos.copy(p);
  showInfo(obj.userData);
  document.querySelectorAll('#planet-nav button').forEach(b => b.classList.toggle('active', b.textContent === obj.userData.name));
}
function goHome() {
  focus = null; fly = { t: 0, from: camera.position.clone(), fromTarget: controls.target.clone(), home: true };
  hideInfo(); document.querySelectorAll('#planet-nav button').forEach(b => b.classList.remove('active'));
}

// ---------- UI ----------
const info = document.getElementById('info');
function showInfo(d) {
  document.getElementById('info-name').textContent = d.name;
  document.getElementById('info-fact').textContent = d.fact;
  document.getElementById('info-stats').innerHTML = Object.entries(d.stats).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  info.classList.add('open');
}
function hideInfo() { info.classList.remove('open'); }

const nav = document.getElementById('planet-nav');
[sun, ...bodies.map(b => b.mesh)].forEach(m => {
  const b = document.createElement('button'); b.textContent = m.userData.name;
  b.onclick = () => focusOn(m); nav.appendChild(b);
});
document.getElementById('info-close').onclick = goHome;
document.getElementById('btn-home').onclick = goHome;
document.getElementById('btn-pause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Play' : 'Pause'; };
document.getElementById('speed').oninput = e => speed = +e.target.value;
document.getElementById('btn-orbits').onclick = e => {
  orbitLines.visible = !orbitLines.visible; e.target.setAttribute('aria-pressed', orbitLines.visible);
};
addEventListener('keydown', e => { if (e.key === 'Escape') goHome(); });

// ---------- Picking (hover tooltip + click) ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = document.getElementById('tooltip');
let downAt = null;
function pick(e) {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickables)[0]; return hit && hit.object;
}
renderer.domElement.addEventListener('pointermove', e => {
  const o = pick(e);
  tip.style.opacity = o ? 1 : 0; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
  if (o) tip.textContent = o.userData.name;
  renderer.domElement.style.cursor = o ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {       // ignore drags, only react to clicks
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const o = pick(e); if (o) focusOn(o);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

// ---------- Animation loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .1), sim = paused ? 0 : dt * speed;

  sun.rotation.y += sim * .05;
  bodies.forEach(p => {
    p.angle += sim * ORBIT_RATE * (Math.PI * 2 / p.orbitDays);                 // orbit
    p.pivot.position.set(Math.cos(p.angle) * p.distance, 0, Math.sin(p.angle) * p.distance);
    p.mesh.rotation.y += sim * SPIN_RATE * (Math.PI * 2 / p.spinHours);        // axial spin
    if (p.moonPivot) p.moonPivot.rotation.y += sim * ORBIT_RATE * (Math.PI * 2 / p.moon.orbitDays);
  });

  if (fly) {                                        // smooth camera transition
    fly.t = Math.min(1, fly.t + dt / 1.6); const k = ease(fly.t);
    if (fly.home) { camera.position.lerpVectors(fly.from, HOME, k); controls.target.lerpVectors(fly.fromTarget, new THREE.Vector3(), k); }
    else { const p = worldPos(focus); camera.position.lerpVectors(fly.from, p.clone().add(fly.offset), k); controls.target.lerpVectors(fly.fromTarget, p, k); }
    if (fly.t >= 1) { if (!fly.home) prevPos.copy(worldPos(focus)); fly = null; }
  } else if (focus) {                               // follow the planet as it orbits
    const p = worldPos(focus); camera.position.add(p.clone().sub(prevPos)); controls.target.copy(p); prevPos.copy(p);
  }

  updateStarfield(starLayers, camera);
  updateShootingStars(shooting, dt, camera);
  controls.update();
  renderer.render(scene, camera);
}
animate();
document.getElementById('loader').classList.add('done');
