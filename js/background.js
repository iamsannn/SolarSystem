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
function updateStarfield(layers, camera) {
  layers.forEach(l => l.position.copy(camera.position).multiplyScalar(l.userData.follow));
}

// Pool of short glowing streaks that fire at random intervals
function createShootingStars(scene, poolSize = 5) {
  const pool = [];
  for (let i = 0; i < poolSize; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1,1,1, 0,0,0]), 3)); // bright head → faded tail
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    line.visible = false; line.frustumCulled = false; scene.add(line);
    pool.push({ line, head: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 });
  }
  return { pool, next: 1 };
}
function updateShootingStars(S, dt, camera) {
  S.next -= dt;
  if (S.next <= 0) {                                   // spawn one at a random time
    S.next = 1.5 + Math.random() * 5;
    const s = S.pool.find(p => p.life <= 0);
    if (s) {
      const dir = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      s.head.copy(camera.position).addScaledVector(dir, 500 + Math.random() * 300);
      s.vel.set(Math.random() - .5, -Math.random() * .6 - .2, Math.random() - .5).normalize().multiplyScalar(500 + Math.random() * 300);
      s.life = .8 + Math.random() * .6; s.line.visible = true;
    }
  }
  S.pool.forEach(s => {
    if (s.life <= 0) return;
    s.life -= dt; s.head.addScaledVector(s.vel, dt);
    const tail = s.head.clone().addScaledVector(s.vel, -.09), p = s.line.geometry.attributes.position;
    p.set([s.head.x, s.head.y, s.head.z, tail.x, tail.y, tail.z]); p.needsUpdate = true;
    s.line.material.opacity = Math.max(0, Math.min(1, s.life * 2));
    if (s.life <= 0) s.line.visible = false;
  });
}
