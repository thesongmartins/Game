// Talks to start.ng through its hidden connect page (https://start.ng/docs, "Talk to start.ng").
// start.ng owns sign-in: the game only ever learns who is playing ({ id, name, account, style, face }),
// saves runs, and reads the leaderboard. It never sees a password, an email or the real sign-in token.

function findStartNg() {
  const { hostname } = location;
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  if (hostname.endsWith('.start.localhost')) return 'http://start.localhost:5173';
  return null; // opened locally or elsewhere: no start.ng, so it plays as a demo guest
}

/** start.ng's address, or null when the game runs somewhere start.ng can't reach. */
export const START_NG = findStartNg();

/** The game's name, from its address: "gem-isle" on gem-isle.start.ng. */
export const GAME = location.hostname.split('.')[0] || 'gem-isle';

let frame;
function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.title = 'start.ng sign-in check';
    el.addEventListener('load', () => resolve(el), { once: true });
    el.addEventListener('error', reject, { once: true });
    document.body.append(el);
  });
  return frame;
}

/** Sends a message to start.ng and resolves to its reply, or null if it didn't answer in time. */
export async function askStartNg(message, replyType, timeoutMs = 5000) {
  if (!START_NG) return null;
  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      // Only start.ng itself, answering from our own frame, is trusted.
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

/**
 * Who is playing. Resolves to { signedIn, id, name, account, style, face }.
 * Signed out on start.ng: start.ng's own guest look, so guests look the same in every game.
 * No start.ng at all (local file, GitHub Pages…): a built-in demo guest, so the game still plays.
 */
export async function whoIsPlaying() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  if (reply?.user) {
    const u = reply.user;
    return { signedIn: true, id: u.id, name: u.name || 'Player', account: u.account || '', style: u.style || null, face: u.face || null };
  }
  if (reply?.guest) {
    const g = reply.guest;
    return { signedIn: false, id: null, name: g.name || 'Guest', account: '', style: g.style || null, face: g.face || null };
  }
  return { signedIn: false, id: null, name: 'Guest', account: '', style: null, face: null, offline: true };
}

/** Calls fn(player) again when the tab comes back: they may have signed in or out on start.ng. */
export function onPlayerChange(fn) {
  if (!START_NG) return;
  let busy = false;
  const recheck = async () => {
    if (document.visibilityState !== 'visible' || busy) return;
    busy = true;
    try {
      const player = await whoIsPlaying();
      if (!player.offline) fn(player);
    } finally {
      busy = false;
    }
  };
  document.addEventListener('visibilitychange', recheck);
  addEventListener('focus', recheck);
}

/** Sends the player to start.ng to sign in (or make an account); start.ng brings them back here. */
export function signIn() {
  const back = location.origin + location.pathname;
  location.href = `${START_NG ?? 'https://start.ng'}/?return_to=${encodeURIComponent(back)}`;
}

/**
 * Saves a run for a signed-in player. `stats` must match startng.json: { gems, time } as whole numbers.
 * Resolves to { ok: true, best, improved, rank, stats } or { ok: false, error }.
 */
export async function saveRun(stats) {
  const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 8000);
  if (!reply) return { ok: false, error: START_NG ? 'start.ng did not answer' : 'Runs are saved on start.ng' };
  return reply.ok ? { ok: true, ...reply.result } : { ok: false, error: reply.error || 'Could not save' };
}

/** The top players: [{ rank, player_id, name, color, score, stats }]. Empty when unavailable. */
export async function leaderboard(limit = 10) {
  const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 8000);
  return reply?.ok && Array.isArray(reply.entries) ? reply.entries : [];
}

/** True when the start.ng homepage opened the game for a player who chose "play as a guest". */
export const CHOSE_GUEST = new URLSearchParams(location.search).has('guest');

// If the player came back from sign-in with a game session in the address, tidy it away.
// This game uses the connect page, so the session itself isn't needed.
if (location.hash.includes('startng_session=')) {
  history.replaceState(null, '', location.pathname + location.search);
}
