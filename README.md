# Gem Isle

A small three.js game for [start.ng](https://start.ng). You run around a floating island as **your own start.ng character**, grab gems, jump over rolling boulders and outrun the slimes. Your best run goes on the game's start.ng leaderboard.

Play it at **https://gem-isle.start.ng** once it's live.

## How to play

| Desktop | Phone |
| --- | --- |
| `WASD` or arrow keys to run | Drag on the left of the screen to run |
| `Space` to jump | Tap **JUMP** |

- Each gem is worth 1. Grab 5 in a row quickly and you heal a heart.
- Boulders roll in from the rim (a red ring shows where). Jump over them or step aside.
- Slimes arrive after 20 seconds and hop after you. They get stunned when they hit you.
- Three hearts. When they're gone the run ends and is saved to the leaderboard if you're signed in.

The leaderboard ranks by **gems collected**, then **time survived** (see `startng.json`).

## Your start.ng character

The game asks start.ng who is playing through the hidden connect page (`src/platform.js`) and builds a 3D version of their character from their start.ng `style` (`src/character.js`):

| start.ng style field | In the game |
| --- | --- |
| `body` (`female` / `male`) | Build, skirt vs trousers |
| `primaryColor` | The top, and cap / beanie / tophat band |
| `secondaryColor` | Skirt or trousers, beanie cuff |
| `skinColor`, `hairColor` | Skin and hair |
| `hair` | short, afro, braids, bun, ponytail, dreads, bald |
| `hat` | none, cap, beanie, tophat, crown |
| `accessory` | none, glasses, earrings, beard, scarf, backpack |

Change your look on start.ng and come back to the tab: the character is rebuilt on the spot. Guests get start.ng's guest look and a **Sign in** button. The card at the top left shows the character's face picture, name and `@account`.

## Project layout

```
index.html        the page, with an import map for three.js (jsDelivr)
startng.json      leaderboard columns: gems, time
cover.png         16:10 cover shown on start.ng
src/main.js       game loop, input, HUD, start.ng wiring
src/character.js  builds the 3D start.ng character from a style
src/world.js      island, gems, boulders, slimes
src/platform.js   talks to start.ng (whoami, scores, leaderboard, sign-in)
src/audio.js      small synthesised sound effects
src/styles.css    HUD and menus
```

No build step and no dependencies to install: it's static files, as start.ng requires. three.js is loaded from jsDelivr, which start.ng allows.

## Run it locally

Serve the folder with any static server, for example:

```
python3 -m http.server 8000
```

then open http://localhost:8000. Outside `*.start.ng` there's no start.ng to talk to, so the game plays as a demo guest with a random sample look; sign-in, scores and the leaderboard only work once it's live on start.ng.

## Publishing on start.ng

1. Push this repo to GitHub (public). `index.html` is at the top of the repo, so no `dist/` is needed.
2. Check it:
   ```
   curl -X POST https://api.start.ng/games/check \
     -H 'Content-Type: application/json' \
     -d '{"repo_url":"https://github.com/<owner>/<repo>","name":"gem-isle"}'
   ```
3. Publish it:
   ```
   curl -X POST https://api.start.ng/games/publish \
     -H 'Content-Type: application/json' \
     -d '{"repo_url":"https://github.com/<owner>/<repo>","name":"gem-isle"}'
   ```
4. Open the `approve_url` from the reply, sign in with start.ng, and say yes. The game is live at `https://gem-isle.start.ng`.
5. After that, every push to the published branch updates the game by itself.

Full docs: https://start.ng/docs
