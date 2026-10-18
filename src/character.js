// The player's start.ng character in 3D, built from their start.ng style so it looks like it does
// on start.ng: body, top and bottoms colours, skin, hair, hat and accessory. Low-poly, about 1.7 m
// tall, facing +z. Unknown or missing values fall back to something sensible.
import * as THREE from 'three';

const PI = Math.PI;
const GOLD = '#e8b84a';
const SHOE = '#2a211b';
const SCARF = '#c8442f';
const LEATHER = '#6b4a2f';

const HAIRS = ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'];
const HATS = ['none', 'cap', 'beanie', 'tophat', 'crown'];
const ACCESSORIES = ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'];
const HEX = /^#[0-9a-f]{6}$/i;

/** The look for a player with no character: start.ng's default-ish neutral style. */
export const DEFAULT_STYLE = {
  body: 'female',
  primaryColor: '#9aa3b5',
  secondaryColor: '#4a4f60',
  skinColor: '#c68642',
  hairColor: '#17120f',
  hair: 'short',
  hat: 'none',
  accessory: 'none',
};

/** A few looks for playing outside start.ng, so a local run still shows the character system. */
export const DEMO_STYLES = [
  { body: 'female', primaryColor: '#a55eea', secondaryColor: '#0c6e5a', skinColor: '#8d5524', hairColor: '#17120f', hair: 'braids', hat: 'crown', accessory: 'earrings' },
  { body: 'male', primaryColor: '#4b7bec', secondaryColor: '#2b2f4a', skinColor: '#5c3a21', hairColor: '#17120f', hair: 'afro', hat: 'none', accessory: 'glasses' },
  { body: 'male', primaryColor: '#f7b731', secondaryColor: '#3d3d3d', skinColor: '#c68642', hairColor: '#4a2c1a', hair: 'dreads', hat: 'beanie', accessory: 'backpack' },
  { body: 'female', primaryColor: '#1dd1a1', secondaryColor: '#5f3dc4', skinColor: '#e0ac69', hairColor: '#d9a441', hair: 'ponytail', hat: 'cap', accessory: 'scarf' },
  { body: 'male', primaryColor: '#eb3b5a', secondaryColor: '#222f3e', skinColor: '#a0662f', hairColor: '#8b5a2b', hair: 'short', hat: 'tophat', accessory: 'beard' },
  { body: 'female', primaryColor: '#fd9644', secondaryColor: '#4b6584', skinColor: '#f1c27d', hairColor: '#c0392b', hair: 'bun', hat: 'none', accessory: 'none' },
];

/** Cleans a style from start.ng: every field present and valid, unknown values replaced. */
export function normaliseStyle(style) {
  const s = { ...DEFAULT_STYLE, ...(style || {}) };
  const colour = (c, fallback) => (typeof c === 'string' && HEX.test(c) ? c : fallback);
  return {
    body: s.body === 'male' ? 'male' : 'female',
    primaryColor: colour(s.primaryColor, DEFAULT_STYLE.primaryColor),
    secondaryColor: colour(s.secondaryColor, DEFAULT_STYLE.secondaryColor),
    skinColor: colour(s.skinColor, DEFAULT_STYLE.skinColor),
    hairColor: colour(s.hairColor, DEFAULT_STYLE.hairColor),
    hair: HAIRS.includes(s.hair) ? s.hair : 'short',
    hat: HATS.includes(s.hat) ? s.hat : 'none',
    accessory: ACCESSORIES.includes(s.accessory) ? s.accessory : 'none',
  };
}

/** A sphere with a bumpy surface, for curly hair. */
function curlyGeometry(r, amount) {
  const g = new THREE.SphereGeometry(r, 28, 20);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 120) * Math.sin(v.y * 130) * Math.sin(v.z * 110);
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Builds the character. Returns { root, style, update(t), setMoving(speed01), setAirborne(bool),
 * setHurt(bool), dispose() }. `root` stands on the ground at y = 0.
 */
export function buildCharacter(style) {
  const s = normaliseStyle(style);
  const female = s.body === 'female';
  const geos = [];
  const mats = new Map();

  const mat = (color, metalness = 0, roughness = 0.7) => {
    const key = `${color}|${metalness}|${roughness}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return mats.get(key);
  };
  const mesh = (geo, m, x = 0, y = 0, z = 0) => {
    geos.push(geo);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  const ball = (r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const o = mesh(new THREE.SphereGeometry(r, 20, 14), m, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  };
  const capsule = (r, len, m, x = 0, y = 0, z = 0) => mesh(new THREE.CapsuleGeometry(r, len, 4, 12), m, x, y, z);
  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const skin = mat(s.skinColor, 0, 0.55);
  const top = mat(s.primaryColor, 0, 0.75);
  const bottoms = mat(s.secondaryColor, 0, 0.85);
  const hair = mat(s.hairColor, 0, 0.8);
  const shoe = mat(SHOE, 0, 0.45);

  const root = new THREE.Group();
  const hipY = female ? 0.88 : 0.9;
  const hips = group(root, 0, hipY, 0);

  // ---- legs: hip > knee > foot. Female wears a skirt in the bottoms colour over skin-tone legs;
  // male wears trousers, so the legs themselves take the bottoms colour.
  const legMat = female ? skin : bottoms;
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = group(hips, side * 0.085, -0.02, 0);
    hip.add(capsule(0.065, 0.26, legMat, 0, -0.18, 0));
    const knee = group(hip, 0, -0.36, 0);
    knee.add(capsule(0.05, 0.26, legMat, 0, -0.17, 0));
    const foot = mesh(new THREE.BoxGeometry(0.11, 0.07, 0.2), shoe, 0, -0.36, 0.04);
    knee.add(foot);
    legs.push({ hip, knee });
  }
  // pelvis / skirt
  if (female) {
    const skirt = mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.3, 20), bottoms, 0, -0.1, 0);
    hips.add(skirt);
  } else {
    hips.add(mesh(new THREE.CylinderGeometry(0.155, 0.15, 0.16, 20), bottoms, 0, -0.02, 0));
  }

  // ---- torso and neck
  const spine = group(hips, 0, 0.04, 0);
  const torso = female
    ? mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.5, 20), top, 0, 0.25, 0)
    : mesh(new THREE.CylinderGeometry(0.19, 0.155, 0.54, 20), top, 0, 0.27, 0);
  torso.scale.z = 0.72;
  spine.add(torso);
  const shoulderY = female ? 0.47 : 0.52;
  const neckTop = female ? 0.6 : 0.66;
  spine.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 12), skin, 0, neckTop - 0.07, 0));
  if (female) for (const side of [-1, 1]) spine.add(ball(0.055, top, side * 0.055, 0.36, 0.06, 1, 0.85, 0.7));

  // ---- arms: shoulder > elbow > hand. Short sleeve in the top colour, then skin.
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = group(spine, side * (female ? 0.19 : 0.23), shoulderY, 0);
    sh.add(ball(female ? 0.06 : 0.07, top, 0, 0, 0));
    sh.add(capsule(female ? 0.05 : 0.056, 0.1, top, 0, -0.08, 0));
    sh.add(capsule(0.04, 0.18, skin, 0, -0.2, 0));
    const elbow = group(sh, 0, -0.3, 0);
    elbow.add(capsule(0.036, 0.2, skin, 0, -0.12, 0));
    elbow.add(ball(0.045, skin, 0, -0.26, 0, 1, 1.2, 0.7));
    arms.push({ sh, elbow });
  }

  // ---- head and face
  const head = group(spine, 0, neckTop + 0.1, 0);
  const sx = female ? 0.9 : 0.95;
  head.add(ball(0.115, skin, 0, 0, 0, sx, 1.08, 1));
  for (const side of [-1, 1]) {
    head.add(ball(0.024, skin, side * 0.105 * sx, -0.005, 0, 0.5, 1, 0.8)); // ears
    head.add(ball(0.017, mat('#f6f1e8', 0, 0.25), side * 0.04, 0.015, 0.095, 1.2, 0.8, 0.6)); // eyes
    head.add(ball(0.009, mat('#2a1a10', 0, 0.15), side * 0.04, 0.015, 0.106));
    const brow = ball(0.02, hair, side * 0.042, 0.048, 0.1, 1.2, female ? 0.22 : 0.32, 0.4);
    brow.rotation.z = side * -0.15;
    head.add(brow);
  }
  head.add(ball(0.016, skin, 0, -0.012, 0.112, 0.85, 1.4, 1)); // nose
  const lipColour = female ? '#a5525a' : new THREE.Color(s.skinColor).multiplyScalar(0.72).getStyle();
  head.add(ball(0.02, mat(lipColour, 0, 0.4), 0, -0.05, s.accessory === 'beard' ? 0.108 : 0.1, 1, 0.3, 0.5));

  // ---- hair
  const sway = []; // parts that bounce with each step
  if (s.hair !== 'bald') {
    const cap = mesh(new THREE.SphereGeometry(0.122, 28, 14, 0, 2 * PI, 0, PI * 0.5), hair, 0, 0.015, -0.012);
    cap.scale.set(sx + 0.02, 1.1, 1.02);
    cap.rotation.x = -0.4;
    head.add(cap);
  }
  if (s.hair === 'afro') {
    const a = mesh(curlyGeometry(0.19, 0.035), hair, 0, 0.065, -0.05);
    a.scale.set(1, 0.9, 0.9);
    head.add(a);
  }
  if (s.hair === 'bun') head.add(mesh(curlyGeometry(0.06, 0.03), hair, 0, 0.12, -0.08));
  if (s.hair === 'ponytail') {
    const tail = group(head, 0, 0.03, -0.11);
    tail.add(ball(0.03, hair));
    const strand = capsule(0.028, 0.22, hair, 0, -0.14, -0.03);
    strand.rotation.x = 0.15;
    tail.add(strand);
    sway.push(tail);
  }
  if (s.hair === 'braids' || s.hair === 'dreads') {
    const braids = s.hair === 'braids';
    const n = braids ? 14 : 16;
    const len = braids ? 0.3 : 0.18;
    const r = braids ? 0.012 : 0.016;
    for (let i = 0; i < n; i++) {
      const a = PI * 0.1 + (i / (n - 1)) * PI * 0.8;
      const strand = group(head, Math.cos(a) * 0.1 * sx, 0.02, -Math.sin(a) * 0.1);
      strand.rotation.z = Math.cos(a) * 0.15;
      strand.add(capsule(r, len, hair, 0, -len / 2 - 0.02, 0));
      sway.push(strand);
    }
  }

  // ---- face accessories
  if (s.accessory === 'beard') {
    const beard = mesh(new THREE.SphereGeometry(0.12, 28, 14, 0, 2 * PI, PI * 0.62, PI * 0.38), hair, 0, -0.005, 0.01);
    beard.scale.set(sx + 0.02, 1.1, 1);
    head.add(beard);
    head.add(ball(0.03, hair, 0, -0.038, 0.1, 1.3, 0.35, 0.5)); // moustache
  }
  if (s.accessory === 'glasses') {
    const frame = mat('#1d1b19', 0.4, 0.35);
    for (const side of [-1, 1]) {
      head.add(mesh(new THREE.TorusGeometry(0.027, 0.004, 8, 20), frame, side * 0.04, 0.015, 0.112));
      head.add(mesh(new THREE.BoxGeometry(0.004, 0.004, 0.11), frame, side * 0.1 * sx, 0.017, 0.055));
    }
    head.add(mesh(new THREE.TorusGeometry(0.012, 0.0035, 8, 12, PI), frame, 0, 0.017, 0.114));
  }
  if (s.accessory === 'earrings') {
    const gold = mat(GOLD, 0.85, 0.25);
    for (const side of [-1, 1]) head.add(mesh(new THREE.TorusGeometry(0.014, 0.0035, 8, 16), gold, side * 0.105 * sx, -0.04, 0));
  }

  // ---- hats (sit higher on an afro)
  const lift = s.hair === 'afro' ? 0.08 : 0;
  if (s.hat === 'cap') {
    const dome = mesh(new THREE.SphereGeometry(0.128, 28, 12, 0, 2 * PI, 0, PI / 2), top, 0, 0.02 + lift, -0.005);
    dome.scale.set(sx + 0.05, 1.15, 1.08);
    head.add(dome);
    const brim = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 20, 1, false, -PI / 2, PI), top, 0, 0.035 + lift, 0.095);
    brim.scale.z = 0.9;
    brim.rotation.x = 0.12;
    head.add(brim);
  }
  if (s.hat === 'beanie') {
    const dome = mesh(new THREE.SphereGeometry(0.13, 28, 14, 0, 2 * PI, 0, PI / 2), top, 0, 0.025 + lift, -0.004);
    dome.scale.set(sx + 0.05, 1.05, 1.07);
    head.add(dome);
    const cuff = mesh(new THREE.TorusGeometry(0.115, 0.022, 10, 28), bottoms, 0, 0.035 + lift, -0.004);
    cuff.rotation.x = PI / 2;
    cuff.scale.set(sx + 0.06, 1.08, 1);
    head.add(cuff);
    head.add(mesh(curlyGeometry(0.035, 0.06), top, 0, 0.165 + lift, -0.01)); // pompom
  }
  if (s.hat === 'tophat') {
    const black = mat('#1b1a18', 0, 0.45);
    const h = group(head, 0, 0.105 + lift, -0.005);
    h.rotation.z = -0.06;
    h.add(mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.014, 28), black));
    h.add(mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.19, 28), black, 0, 0.1, 0));
    h.add(mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.035, 28), top, 0, 0.03, 0));
  }
  if (s.hat === 'crown') {
    const gold = mat(GOLD, 0.85, 0.28);
    const c = group(head, 0, 0.105 + lift, -0.005);
    c.add(mesh(new THREE.CylinderGeometry(0.098, 0.092, 0.055, 28, 1, true), gold));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      c.add(mesh(new THREE.ConeGeometry(0.02, 0.055, 10), gold, Math.sin(a) * 0.092, 0.05, Math.cos(a) * 0.092));
      c.add(ball(0.008, gold, Math.sin(a) * 0.092, 0.08, Math.cos(a) * 0.092));
    }
    c.add(mesh(new THREE.OctahedronGeometry(0.014), mat('#d6263b', 0.2, 0.15), 0, 0.005, 0.098));
  }

  // ---- body accessories
  if (s.accessory === 'scarf') {
    const sc = mat(SCARF, 0, 0.9);
    const ring = mesh(new THREE.TorusGeometry(0.075, 0.032, 12, 24), sc, 0, neckTop - 0.1, 0.005);
    ring.rotation.x = PI / 2 - 0.15;
    ring.scale.set(1.08, 0.85, 1);
    spine.add(ring);
    const tail = capsule(0.028, 0.16, sc, 0.065, neckTop - 0.24, 0.1);
    tail.scale.z = 0.5;
    tail.rotation.z = 0.08;
    spine.add(tail);
  }
  if (s.accessory === 'backpack') {
    const lea = mat(LEATHER, 0, 0.65);
    const zBack = female ? -0.13 : -0.15;
    const bag = mesh(new THREE.BoxGeometry(0.26, 0.3, 0.14), lea, 0, 0.32, zBack - 0.05);
    spine.add(bag);
    spine.add(mesh(new THREE.BoxGeometry(0.18, 0.1, 0.06), mat('#57391f', 0, 0.65), 0, 0.22, zBack - 0.14));
    for (const side of [-1, 1]) {
      const strap = capsule(0.013, 0.3, lea, side * 0.09, 0.32, female ? 0.1 : 0.12);
      strap.scale.x = 1.6;
      spine.add(strap);
    }
  }

  // ---- animation
  const restArm = female ? 0.12 : 0.15;
  let moveTarget = 0; // 0 standing, 1 running
  let move = 0;
  let airborne = false;
  let hurt = false;
  let phase = 0;
  let last = 0;

  function update(t) {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    move += (moveTarget - move) * Math.min(1, dt * 10);
    const w = Math.min(1, move);
    phase += dt * PI * 2 * 2.2 * Math.max(move, 0.0001);

    // idle: breathing, weight shift, looking about
    const shift = Math.sin(t * 0.8) * (1 - w);
    hips.position.x = shift * 0.012;
    spine.rotation.z = -shift * 0.03;
    spine.rotation.x = Math.sin(t * 1.5) * 0.01 + w * 0.12;
    torso.scale.y = 1 + Math.sin(t * 1.5) * 0.008;
    head.rotation.y = Math.sin(t * 0.45) * 0.35 * (1 - w);
    head.rotation.x = Math.sin(t * 0.3) * 0.05 - w * 0.08;

    const stride = Math.sin(phase);
    legs.forEach(({ hip, knee }, i) => {
      const s2 = i === 0 ? stride : -stride;
      hip.rotation.x = -s2 * 0.7 * w;
      const walkKnee = Math.max(0, Math.sin(phase + (i === 0 ? 0 : PI) + PI / 2)) * 1.0;
      knee.rotation.x = walkKnee * w;
    });
    arms.forEach(({ sh, elbow }, i) => {
      const side = i === 0 ? -1 : 1;
      const s2 = i === 0 ? -stride : stride;
      sh.rotation.z = side * (restArm + Math.sin(t * 1.5 + i) * 0.02 * (1 - w));
      sh.rotation.x = Math.sin(t * 0.7 + i * PI) * 0.05 * (1 - w) - s2 * 0.8 * w;
      elbow.rotation.x = -0.2 - 0.6 * w;
    });
    hips.position.y = hipY + (Math.abs(Math.cos(phase)) - 0.6) * 0.05 * w;

    if (airborne) {
      // tuck the legs, throw the arms up
      legs.forEach(({ hip, knee }) => {
        hip.rotation.x = -0.9;
        knee.rotation.x = 1.3;
      });
      arms.forEach(({ sh, elbow }, i) => {
        sh.rotation.z = (i === 0 ? -1 : 1) * 1.2;
        sh.rotation.x = -0.6;
        elbow.rotation.x = -0.4;
      });
      hips.position.y = hipY + 0.12;
    }
    if (hurt) {
      spine.rotation.x = -0.25;
      head.rotation.x = -0.3;
    }
    for (let i = 0; i < sway.length; i++) sway[i].rotation.x = Math.sin(t * 1.3 + i * 0.3) * 0.04 - head.rotation.x + w * 0.3;
  }
  update(0);

  return {
    root,
    style: s,
    update,
    setMoving(speed) {
      moveTarget = speed;
    },
    setAirborne(v) {
      airborne = v;
    },
    setHurt(v) {
      hurt = v;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
