// Gem Isle: run around a floating island as your start.ng character, collect gems and stay alive.
import * as THREE from "three";
import { buildCharacter, DEMO_STYLES } from "./character.js";
import { buildIsland, Gems, Boulders, Slimes, PLAY_RADIUS } from "./world.js";
import {
  START_NG,
  CHOSE_GUEST,
  whoIsPlaying,
  onPlayerChange,
  signIn,
  saveRun,
  leaderboard,
} from "./platform.js";
import { sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);
const ui = {
  card: $("player-card"),
  face: $("player-face"),
  name: $("player-name"),
  account: $("player-account"),
  signIn: $("player-sign-in"),
  hud: $("hud"),
  hearts: [...$("hearts").children],
  gems: $("gem-count"),
  timer: $("timer"),
  toast: $("toast"),
  flash: $("flash"),
  overlay: $("overlay"),
  title: $("title"),
  message: $("message"),
  result: $("result"),
  rGems: $("r-gems"),
  rTime: $("r-time"),
  note: $("note"),
  action: $("action"),
  boardBtn: $("board-btn"),
  board: $("board"),
  hint: $("hint"),
  joystick: $("joystick"),
  knob: $("joystick").firstElementChild,
  jumpBtn: $("jump-btn"),
};
const touch = matchMedia("(pointer: coarse)").matches;
const fmtTime = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---- renderer, scene, camera
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
const island = buildIsland(scene);
const gems = new Gems(scene);
const boulders = new Boulders(scene);
const slimes = new Slimes(scene);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ---- the player
let player = null; // { signedIn, id, name, account, style, face }
let character = null;
const pos = new THREE.Vector3(0, 0, 4);
const vel = new THREE.Vector3();
let vy = 0;
let facing = 0;
let demoIndex = Math.floor(Math.random() * DEMO_STYLES.length);

function dressCharacter(style) {
  if (character) {
    scene.remove(character.root);
    character.dispose();
  }
  character = buildCharacter(style);
  character.root.position.copy(pos);
  character.root.rotation.y = facing;
  scene.add(character.root);
}

function showPlayer(p) {
  player = p;
  const demo = !START_NG;
  ui.name.textContent = p.name;
  ui.account.textContent = p.signedIn
    ? `@${p.account}`
    : demo
      ? "Demo look · not on start.ng"
      : "Not signed in";
  ui.face.hidden = !p.face;
  if (p.face) ui.face.src = p.face;
  ui.signIn.hidden = p.signedIn || demo;
  ui.card.hidden = false;
  dressCharacter(p.style || (demo ? DEMO_STYLES[demoIndex] : null));
}

ui.signIn.onclick = signIn;

// ---- input
const keys = new Set();
let wantJump = false;
addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code !== "Space") return;
  e.preventDefault();
  if (state === "playing") wantJump = true;
  else if (!ui.overlay.hidden && !ui.action.disabled) ui.action.click();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

const stick = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
function stickStart(e) {
  for (const t of e.changedTouches) {
    if (stick.active || t.clientX > innerWidth * 0.6) continue;
    stick.active = true;
    stick.id = t.identifier;
    stick.cx = t.clientX;
    stick.cy = t.clientY;
    ui.joystick.style.left = `${t.clientX}px`;
    ui.joystick.style.top = `${t.clientY}px`;
    ui.joystick.hidden = false;
    stickMove(e);
  }
}
function stickMove(e) {
  for (const t of e.changedTouches) {
    if (t.identifier !== stick.id) continue;
    const dx = t.clientX - stick.cx;
    const dy = t.clientY - stick.cy;
    const d = Math.hypot(dx, dy);
    const m = Math.min(1, d / 48);
    stick.x = d ? (dx / d) * m : 0;
    stick.y = d ? (dy / d) * m : 0;
    ui.knob.style.transform = `translate(calc(-50% + ${stick.x * 34}px), calc(-50% + ${stick.y * 34}px))`;
  }
}
function stickEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier !== stick.id) continue;
    stick.active = false;
    stick.id = null;
    stick.x = stick.y = 0;
    ui.joystick.hidden = true;
    ui.knob.style.transform = "translate(-50%, -50%)";
  }
}
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    stickStart(e);
  },
  { passive: false },
);
canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    stickMove(e);
  },
  { passive: false },
);
canvas.addEventListener("touchend", stickEnd);
canvas.addEventListener("touchcancel", stickEnd);
ui.jumpBtn.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    wantJump = true;
  },
  { passive: false },
);
ui.jumpBtn.addEventListener("click", () => {
  wantJump = true;
});

function inputVector() {
  let x = 0;
  let z = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (stick.active) {
    x += stick.x;
    z += stick.y;
  }
  const len = Math.hypot(x, z);
  return len > 1 ? { x: x / len, z: z / len, m: 1 } : { x, z, m: len };
}

// ---- game state
let state = "idle"; // idle | playing | over
let hearts = 3;
let gemCount = 0;
let streak = 0;
let lastGemAt = -10;
let elapsed = 0;
let invuln = 0;
let nextBoulder = 0;
let nextGem = 0;
let nextSlime = 0;
let slimeCount = 0;

const SPEED = 6.8;
const GRAVITY = 24;
const JUMP = 9.2; // clears the biggest boulder

function setHearts(n) {
  hearts = Math.max(0, Math.min(3, n));
  ui.hearts.forEach((h, i) => h.classList.toggle("lost", i >= hearts));
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  ui.toast.style.animation = "none";
  void ui.toast.offsetWidth; // restart the animation
  ui.toast.style.animation = "";
}

function startGame() {
  sfx.unlock();
  sfx.start();
  gems.clear();
  boulders.clear();
  slimes.clear();
  pos.set(0, 0, 4);
  vel.set(0, 0, 0);
  vy = 0;
  facing = 0;
  setHearts(3);
  gemCount = 0;
  streak = 0;
  elapsed = 0;
  invuln = 0;
  nextBoulder = 3.5;
  nextGem = 0;
  nextSlime = 20;
  slimeCount = 0;
  ui.gems.textContent = "0";
  ui.timer.textContent = "0:00";
  for (let i = 0; i < 5; i++) gems.spawn(pos);
  ui.overlay.hidden = true;
  ui.hud.hidden = false;
  ui.jumpBtn.hidden = !touch;
  character?.setHurt(false);
  state = "playing";
}

async function endGame() {
  state = "over";
  sfx.over();
  ui.hud.hidden = true;
  ui.jumpBtn.hidden = true;
  ui.joystick.hidden = true;
  const time = Math.floor(elapsed);
  ui.title.textContent = "Run over";
  ui.message.textContent = `${player?.name ?? "You"} grabbed ${gemCount} gem${gemCount === 1 ? "" : "s"} and lasted ${fmtTime(time)}.`;
  ui.rGems.textContent = String(gemCount);
  ui.rTime.textContent = fmtTime(time);
  ui.result.hidden = false;
  ui.action.textContent = "Play again";
  ui.note.hidden = true;
  ui.board.hidden = true;
  ui.boardBtn.hidden = false;
  ui.overlay.hidden = false;

  if (player?.signedIn) {
    ui.note.textContent = "Saving your run…";
    ui.note.hidden = false;
    const saved = await saveRun({ gems: gemCount, time });
    if (saved.ok) {
      ui.note.textContent = saved.improved
        ? `New best! You're #${saved.rank} on the leaderboard.`
        : `Not your best this time. You're #${saved.rank} with ${saved.stats?.gems ?? saved.best} gems.`;
    } else {
      ui.note.textContent = saved.error || "Could not save this run.";
    }
    showBoard();
  } else if (START_NG) {
    ui.note.textContent =
      "Sign in with start.ng to put this run on the leaderboard.";
    ui.note.hidden = false;
  }
}

async function showBoard() {
  ui.boardBtn.disabled = true;
  const entries = await leaderboard(10);
  ui.boardBtn.disabled = false;
  ui.board.replaceChildren();
  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = START_NG
      ? "No runs saved yet. Be the first!"
      : "The leaderboard lives on start.ng.";
    ui.board.append(li);
  }
  for (const e of entries) {
    const li = document.createElement("li");
    if (player?.id != null && e.player_id === player.id) li.className = "me";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${e.rank}`;
    const name = document.createElement("span");
    name.className = "name";
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = e.color || "#9aa3b5";
    name.append(dot, document.createTextNode(e.name));
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `${e.stats?.gems ?? e.score} 💎`;
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = fmtTime(e.stats?.time ?? 0);
    li.append(rank, name, n, t);
    ui.board.append(li);
  }
  ui.board.hidden = false;
}

ui.action.onclick = startGame;
ui.boardBtn.onclick = () =>
  ui.board.hidden ? showBoard() : (ui.board.hidden = true);

function hurt(fromX, fromZ) {
  if (invuln > 0 || state !== "playing") return;
  setHearts(hearts - 1);
  invuln = 2;
  streak = 0;
  sfx.hit();
  ui.flash.classList.add("on");
  setTimeout(() => ui.flash.classList.remove("on"), 60);
  // knock the player away from what hit them, and a little into the air
  const dx = pos.x - fromX;
  const dz = pos.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  vel.set((dx / d) * 9, 0, (dz / d) * 9);
  if (pos.y <= 0) vy = 4;
  character?.setHurt(true);
  setTimeout(() => character?.setHurt(false), 450);
  if (hearts === 0) endGame();
}

// ---- main loop
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 10, 16);
let blinkHidden = false;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  island.update(dt);
  gems.update(t, dt);

  if (state === "playing") {
    elapsed += dt;
    ui.timer.textContent = fmtTime(elapsed);

    // movement
    const inp = inputVector();
    const target = new THREE.Vector3(inp.x * SPEED, 0, inp.z * SPEED);
    const accel = inp.m > 0 ? 14 : 10;
    vel.x += (target.x - vel.x) * Math.min(1, dt * accel);
    vel.z += (target.z - vel.z) * Math.min(1, dt * accel);
    if (wantJump && pos.y <= 0) {
      vy = JUMP;
      sfx.jump();
    }
    wantJump = false;
    vy -= GRAVITY * dt;
    pos.y = Math.max(0, pos.y + vy * dt);
    if (pos.y === 0 && vy < 0) vy = 0;
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;

    // keep on the island and out of the trees
    const r = Math.hypot(pos.x, pos.z);
    if (r > PLAY_RADIUS) {
      pos.x *= PLAY_RADIUS / r;
      pos.z *= PLAY_RADIUS / r;
    }
    for (const o of island.obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.35;
      if (d < min && d > 0) {
        pos.x = o.x + (dx / d) * min;
        pos.z = o.z + (dz / d) * min;
      }
    }

    const speed = Math.hypot(vel.x, vel.z);
    if (speed > 0.5) facing = Math.atan2(vel.x, vel.z);
    character.setMoving(Math.min(1, speed / SPEED));
    character.setAirborne(pos.y > 0.05);

    // gems
    if (pos.y < 1.2) {
      const got = gems.collect(pos.x, pos.z);
      if (got) {
        streak = elapsed - lastGemAt < 2.6 ? streak + got : got;
        lastGemAt = elapsed;
        gemCount += got;
        ui.gems.textContent = String(gemCount);
        sfx.gem(streak);
        if (streak > 0 && streak % 5 === 0) {
          if (hearts < 3) {
            setHearts(hearts + 1);
            toast(`Streak ×${streak}: +1 heart`);
          } else toast(`Streak ×${streak}!`);
        } else if (streak >= 3) toast(`Streak ×${streak}`);
      }
    }
    nextGem -= dt;
    if (nextGem <= 0 && gems.items.length < 6) {
      gems.spawn(pos);
      nextGem = 1.4;
    }

    // hazards ramp up over two minutes
    const ramp = Math.min(1, elapsed / 120);
    nextBoulder -= dt;
    if (nextBoulder <= 0) {
      boulders.launch(pos, 6.5 + ramp * 5.5);
      nextBoulder = 3.2 - ramp * 2.2;
    }
    nextSlime -= dt;
    if (nextSlime <= 0 && slimeCount < 4) {
      slimes.spawn(pos);
      slimeCount++;
      nextSlime = 25;
    }
    boulders.update(dt, pos, (b) => hurt(b.mesh.position.x, b.mesh.position.z));
    slimes.update(dt, t, pos, (s) => hurt(s.g.position.x, s.g.position.z));

    if (invuln > 0) {
      invuln -= dt;
      const hide = Math.floor(invuln * 12) % 2 === 0;
      if (hide !== blinkHidden) {
        blinkHidden = hide;
        character.root.visible = !hide;
      }
      if (invuln <= 0) character.root.visible = true;
    }
  } else {
    // on the menus the character idles on the island while the world keeps turning
    boulders.update(dt, null, () => {});
    slimes.update(dt, t, null, () => {});
    character?.setMoving(0);
    character?.setAirborne(false);
  }

  if (character) {
    character.root.position.copy(pos);
    let d = facing - character.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    character.root.rotation.y += d * Math.min(1, dt * 12);
    character.update(t);
  }

  // camera follows from behind and above
  camTarget.set(pos.x, 1 + pos.y * 0.5, pos.z);
  const wanted = new THREE.Vector3(
    pos.x * 0.92,
    7.4 + pos.y * 0.3,
    pos.z * 0.92 + 9.8,
  );
  camPos.lerp(wanted, Math.min(1, dt * 4));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  renderer.render(scene, camera);
}

// ---- boot: find out who's playing, then open the menu
async function boot() {
  ui.action.disabled = true;
  ui.action.textContent = "Loading…";
  const p = await whoIsPlaying();
  showPlayer(p);
  ui.action.disabled = false;
  ui.action.textContent = "Play";
  if (!p.signedIn && START_NG && !CHOSE_GUEST) {
    ui.message.textContent =
      "Playing as a guest. Sign in with start.ng to bring your own character and save your runs.";
  } else if (p.signedIn) {
    ui.message.textContent = `Welcome, ${p.name}. Grab gems, dodge the boulders, outrun the slimes.`;
  }
  onPlayerChange((next) => {
    const same =
      next.id === player?.id &&
      JSON.stringify(next.style) === JSON.stringify(player?.style) &&
      next.name === player?.name;
    if (!same) showPlayer(next);
  });
}

frame();
boot();
