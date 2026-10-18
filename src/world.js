// The island: ground, trees, rocks, water, clouds, lights. Plus the things that move on it:
// gems to collect, boulders that roll across, and slimes that hop after the player.
import * as THREE from 'three';

export const ISLAND_RADIUS = 17;
export const PLAY_RADIUS = 15.6; // how far the player can go

const PI = Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
}

/** Builds the static island and lighting into `scene`. Returns { trees } for collision. */
export function buildIsland(scene) {
  scene.background = new THREE.Color('#9fd6f5');
  scene.fog = new THREE.Fog('#9fd6f5', 45, 110);

  const hemi = new THREE.HemisphereLight('#dff3ff', '#5a7d3a', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4d6', 2.0);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
  sun.shadow.camera.right = sun.shadow.camera.top = 24;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // grass top with a gentle bumpy edge, dirt underneath, rock at the very bottom
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.6, 0.9, 64), standard('#6fbf4a'));
  grass.position.y = -0.45;
  grass.receiveShadow = true;
  scene.add(grass);
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS - 0.6, ISLAND_RADIUS - 5, 4.5, 48), standard('#8a5a33'));
  dirt.position.y = -3.1;
  scene.add(dirt);
  const base = new THREE.Mesh(new THREE.ConeGeometry(ISLAND_RADIUS - 5, 7, 24), standard('#5c4030'));
  base.rotation.x = PI;
  base.position.y = -8.8;
  scene.add(base);

  // lighter grass patches
  const patch = standard('#86d35a');
  for (let i = 0; i < 18; i++) {
    const r = Math.sqrt(Math.random()) * (ISLAND_RADIUS - 2);
    const a = rand(0, PI * 2);
    const p = new THREE.Mesh(new THREE.CircleGeometry(rand(0.8, 2.4), 16), patch);
    p.rotation.x = -PI / 2;
    p.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
    p.receiveShadow = true;
    scene.add(p);
  }

  // a sandy path ring so the island reads as a place
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.4, 64), standard('#d9c88f'));
  ring.rotation.x = -PI / 2;
  ring.position.y = 0.01;
  ring.receiveShadow = true;
  scene.add(ring);

  // water far below, big enough to reach the fog
  const water = new THREE.Mesh(new THREE.CircleGeometry(220, 48), standard('#3aa0d8', { roughness: 0.3, metalness: 0.1 }));
  water.rotation.x = -PI / 2;
  water.position.y = -14;
  scene.add(water);

  // trees near the rim, never on the path or the middle
  const trees = [];
  const trunkMat = standard('#6b4a2f');
  const leafMats = ['#2f8f3a', '#3aa64a', '#2a7c48'].map((c) => standard(c));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2 + rand(-0.15, 0.15);
    const r = rand(11.5, ISLAND_RADIUS - 2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const g = new THREE.Group();
    const h = rand(1.2, 1.9);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h, 8), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = leafMats[i % leafMats.length];
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25 - k * 0.3, 1.3, 9), leaf);
      cone.position.y = h + 0.5 + k * 0.75;
      cone.castShadow = true;
      g.add(cone);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    trees.push({ x, z, r: 0.45 });
  }

  // rocks
  const rockMat = standard('#8d9099');
  for (let i = 0; i < 9; i++) {
    const a = rand(0, PI * 2);
    const r = rand(9.5, ISLAND_RADIUS - 1.5);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.35, 0.7), 0), rockMat);
    rock.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
    rock.rotation.set(rand(0, PI), rand(0, PI), 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    trees.push({ x: rock.position.x, z: rock.position.z, r: 0.5 });
  }

  // clouds drifting around
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(1.2, 2.4), 10, 8), cloudMat);
      puff.position.set(k * 1.6 - 2.4, rand(-0.3, 0.3), rand(-0.6, 0.6));
      c.add(puff);
    }
    c.position.set(rand(-60, 60), rand(10, 20), rand(-60, 60));
    c.userData.speed = rand(0.4, 0.9);
    scene.add(c);
    clouds.push(c);
  }

  return {
    obstacles: trees,
    update(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 70) c.position.x = -70;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Gems

const GEM_COLOURS = ['#ff4d6d', '#4dd2ff', '#ffd93d', '#9d4dff', '#4dff88'];

export class Gems {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geo = new THREE.OctahedronGeometry(0.38, 0);
    this.mats = GEM_COLOURS.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.2 }));
    this.ringGeo = new THREE.RingGeometry(0.3, 0.42, 24);
    this.rings = [];
  }

  spawn(avoid) {
    for (let tries = 0; tries < 20; tries++) {
      const r = Math.sqrt(Math.random()) * (PLAY_RADIUS - 1.5);
      const a = rand(0, PI * 2);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 3) continue;
      if (this.items.some((g) => Math.hypot(g.mesh.position.x - x, g.mesh.position.z - z) < 2)) continue;
      const mesh = new THREE.Mesh(this.geo, this.mats[Math.floor(Math.random() * this.mats.length)]);
      mesh.position.set(x, 0.9, z);
      mesh.castShadow = true;
      mesh.scale.setScalar(0.01);
      this.scene.add(mesh);
      const shadow = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: mesh.material.color, transparent: true, opacity: 0.35 }));
      shadow.rotation.x = -PI / 2;
      shadow.position.set(x, 0.02, z);
      this.scene.add(shadow);
      this.items.push({ mesh, shadow, born: performance.now() / 1000, phase: rand(0, PI * 2) });
      return;
    }
  }

  /** Removes gems within reach of (x, z). Returns how many were taken. */
  collect(x, z, reach = 1.1) {
    let n = 0;
    this.items = this.items.filter((g) => {
      if (Math.hypot(g.mesh.position.x - x, g.mesh.position.z - z) > reach) return true;
      this.burst(g.mesh.position, g.mesh.material.color);
      this.scene.remove(g.mesh, g.shadow);
      g.shadow.material.dispose();
      n++;
      return false;
    });
    return n;
  }

  burst(at, color) {
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -PI / 2;
    ring.position.set(at.x, 0.05, at.z);
    this.scene.add(ring);
    this.rings.push({ mesh: ring, t: 0 });
  }

  update(t, dt) {
    for (const g of this.items) {
      g.mesh.rotation.y = t * 1.8 + g.phase;
      g.mesh.position.y = 0.9 + Math.sin(t * 2.5 + g.phase) * 0.15;
      const age = t - g.born;
      const sc = Math.min(1, age * 4);
      g.mesh.scale.setScalar(0.01 + sc * 0.99);
    }
    this.rings = this.rings.filter((r) => {
      r.t += dt * 2.5;
      r.mesh.scale.setScalar(1 + r.t * 4);
      r.mesh.material.opacity = Math.max(0, 0.9 - r.t);
      if (r.t >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        return false;
      }
      return true;
    });
  }

  clear() {
    for (const g of this.items) {
      this.scene.remove(g.mesh, g.shadow);
      g.shadow.material.dispose();
    }
    this.items = [];
  }
}

// ---------------------------------------------------------------------------------------------
// Boulders: roll from one side of the island to the other, through a point near the player.

export class Boulders {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.mat = new THREE.MeshStandardMaterial({ color: '#7d7f86', roughness: 0.95, flatShading: true });
    this.warnGeo = new THREE.RingGeometry(0.5, 0.7, 24);
    this.warnMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  }

  /** Starts a boulder at the rim, aimed at a point near `target`, after a short warning. */
  launch(target, speed) {
    const radius = rand(0.8, 1.25);
    const a = rand(0, PI * 2);
    const start = new THREE.Vector3(Math.cos(a) * (ISLAND_RADIUS - 0.4), radius, Math.sin(a) * (ISLAND_RADIUS - 0.4));
    const aim = new THREE.Vector3(target.x + rand(-2.5, 2.5), radius, target.z + rand(-2.5, 2.5));
    const dir = aim.clone().sub(start).setY(0).normalize();
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), this.mat);
    mesh.position.copy(start);
    mesh.castShadow = true;
    const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    // warning marker where it will enter the island
    const entry = start.clone().add(dir.clone().multiplyScalar(1.5));
    const warn = new THREE.Mesh(this.warnGeo, this.warnMat);
    warn.rotation.x = -PI / 2;
    warn.position.set(entry.x, 0.03, entry.z);
    this.scene.add(warn);
    this.items.push({ mesh, dir, axis, radius, speed, warn, delay: 0.9, dist: 0 });
  }

  update(dt, player, onHit) {
    const q = new THREE.Quaternion();
    this.items = this.items.filter((b) => {
      if (b.delay > 0) {
        b.delay -= dt;
        b.warn.scale.setScalar(1 + Math.sin(b.delay * 20) * 0.15);
        if (b.delay <= 0) {
          this.scene.remove(b.warn);
          this.scene.add(b.mesh);
        }
        return true;
      }
      const step = b.speed * dt;
      b.mesh.position.addScaledVector(b.dir, step);
      q.setFromAxisAngle(b.axis, step / b.radius);
      b.mesh.quaternion.premultiply(q);
      b.dist += step;
      if (player && player.y < b.radius * 1.15) {
        const d = Math.hypot(b.mesh.position.x - player.x, b.mesh.position.z - player.z);
        if (d < b.radius + 0.45) onHit(b);
      }
      if (b.dist > ISLAND_RADIUS * 2 + 8) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        return false;
      }
      return true;
    });
  }

  clear() {
    for (const b of this.items) {
      this.scene.remove(b.mesh, b.warn);
      b.mesh.geometry.dispose();
    }
    this.items = [];
  }
}

// ---------------------------------------------------------------------------------------------
// Slimes: bouncy blobs that hop toward the player. They don't leave the island.

export class Slimes {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geo = new THREE.SphereGeometry(0.55, 16, 12);
    this.eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: '#1b1b1b' });
    this.mats = ['#7cf24d', '#4de0f2', '#f24d9d'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, transparent: true, opacity: 0.92 }));
  }

  spawn(player) {
    const a = rand(0, PI * 2);
    const r = ISLAND_RADIUS - 2;
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geo, this.mats[this.items.length % this.mats.length]);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeo, this.eyeMat);
      eye.position.set(side * 0.2, 0.65, 0.45);
      g.add(eye);
    }
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    this.items.push({ g, body, hop: rand(0, PI), speed: rand(2.2, 3.2), stun: 0, born: 0 });
  }

  update(dt, t, player, onHit) {
    for (const s of this.items) {
      s.born += dt;
      s.g.scale.setScalar(Math.min(1, s.born * 2));
      s.hop += dt * 3.2;
      const air = Math.max(0, Math.sin(s.hop));
      s.body.position.y = 0.5 + air * 0.9;
      s.body.scale.set(1 + (1 - air) * 0.12, 1 - (1 - air) * 0.15 + air * 0.1, 1 + (1 - air) * 0.12);
      if (s.stun > 0) {
        s.stun -= dt;
        continue;
      }
      if (!player) continue;
      const dx = player.x - s.g.position.x;
      const dz = player.z - s.g.position.z;
      const d = Math.hypot(dx, dz) || 1;
      // moves only while in the air, like a hop
      const v = s.speed * air * dt;
      s.g.position.x += (dx / d) * v;
      s.g.position.z += (dz / d) * v;
      s.g.rotation.y = Math.atan2(dx, dz);
      const rr = Math.hypot(s.g.position.x, s.g.position.z);
      if (rr > PLAY_RADIUS) {
        s.g.position.x *= PLAY_RADIUS / rr;
        s.g.position.z *= PLAY_RADIUS / rr;
      }
      if (d < 0.95 && player.y < 1.0 && s.born > 1) {
        s.stun = 1.2;
        onHit(s);
      }
    }
  }

  clear() {
    for (const s of this.items) this.scene.remove(s.g);
    this.items = [];
  }
}
