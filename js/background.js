/* background.js — parallax starfield + randomized shooting stars. */

// Three star layers. Layers follow the camera by different amounts, so nearer
// layers drift against farther ones as you move (parallax).
function createStarfield(scene) {
  const layers = [
    { count: 2500, radius: 1800, size: 1.3, follow: 0.98 },
    { count: 1200, radius: 1200, size: 2.0, follow: 0.94 },
    { count: 400,  radius: 800,  size: 3.0, follow: 0.88 }
  ];
  const tints = [0xffffff, 0xcfdcff, 0xffe6c4];
  return layers.map(L => {
    const pos = new Float32Array(L.count * 3), col = new Float32Array(L.count * 3), c = new THREE.Color();
    for (let i = 0; i < L.count; i++) {
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
    l.rotation.y = t * (0.0015 + i * 0.0012);          // very slow galaxy drift, nearer layers move a bit faster
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

// Asteroid belt between Mars and Jupiter: one InstancedMesh = 1400 rocks in a single draw call.
// Each rock follows a Kepler-style orbit (inner rocks move faster) and tumbles continuously,
// driven by the time step, so motion is smooth at any speed.
function createAsteroidBelt(scene, count = 1400, inner = 43, outer = 52) {
  const geo = new THREE.IcosahedronGeometry(1, 1), pos = geo.attributes.position, v = new THREE.Vector3(), nz = makeNoise(7);
  for (let i = 0; i < pos.count; i++) {                  // lumpy, irregular shape
    v.fromBufferAttribute(pos, i); v.multiplyScalar(.7 + .6 * nz(v.x * 1.5 + 5, v.y * 1.5 + v.z * 2 + 5, 3)); pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), count), col = new THREE.Color(), data = [];
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  for (let i = 0; i < count; i++) {
    data.push({ r: inner + (outer - inner) * (Math.random() + Math.random()) / 2, a: Math.random() * Math.PI * 2, y: (Math.random() - .5) * 2.4,
      s: .07 + Math.pow(Math.random(), 3) * .4, rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - .5) * 1.4, sy: (Math.random() - .5) * 1.4 });
    mesh.setColorAt(i, col.setHSL(.07 + Math.random() * .05, .12 + Math.random() * .1, .3 + Math.random() * .3));
  }
  scene.add(mesh); return { mesh, data, dummy: new THREE.Object3D() };
}
function updateAsteroidBelt(B, sim, orbitRate) {
  B.data.forEach((d, i) => {
    d.a += sim * orbitRate * (Math.PI * 2 / (1680 * Math.pow(d.r / 47.5, 1.5)));   // ~4.6-year belt period
    d.rx += sim * d.sx; d.ry += sim * d.sy;
    B.dummy.position.set(Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r);
    B.dummy.rotation.set(d.rx, d.ry, 0); B.dummy.scale.setScalar(d.s); B.dummy.updateMatrix();
    B.mesh.setMatrixAt(i, B.dummy.matrix);
  });
  B.mesh.instanceMatrix.needsUpdate = true;
}
