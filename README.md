# Typemon

A keyboard-first monster-battler, and the first plugin game built on the
[Typejoy](https://github.com/ahrazzle/typejoy) typing framework.

Type the glowing key **in rhythm** to attack. Correct keystrokes drive the
battle; the typing loop *is* the combat system rather than a layer over it.

- **Demo entry point:** [`demo/index.html`](demo/index.html)
- **No build step, no dependencies** — it is a static ES-module app.
- **Requires a physical keyboard** (there is no touch control path).

---

## Play the demo locally

ES modules will not load over `file://`, so serve the folder over HTTP:

```sh
# from the repository root
python3 -m http.server 8000
# then open:
#   http://localhost:8000/demo/
```

Open `demo/index.html` through that server, click **START**, and play.

## Controls

**Overworld**

| Input | Action |
|---|---|
| Arrow keys / `W` `A` `S` `D` | Walk |
| `Enter` or `Space` | Interact with the tile you are facing (doors, cave mouths) |
| `C` | Open the collection |

**Battle**

| Input | Action |
|---|---|
| The letter shown on the glowing key | Attack the enemy — type it in time with the beat |
| `Space` | Advance to the next word (spaces are charted notes; resting on one is never punished) |
| A wrong letter | Dodge — it costs you tempo, it never drains HP |

Timing grades the hit: **Perfect** is a critical, then **Great**, then **Good**.
Miss the beat and the enemy strikes. Hit streaks charge the ultimate and the
capture throw.

**Menus**

| Input | Action |
|---|---|
| `1` `2` `3` (or click) | Pick your starter |
| `1`–`9` | Switch active monster in the collection |
| `C` or `Esc` | Close the collection |

## Gameplay loop

1. **Pick a starter** — one of three original monsters.
2. **Walk Route A** — `START -> GRASS A -> GRASS B -> CAVE BOSS -> END`.
   Walking in grass triggers wild encounters.
3. **Battle** — type each attack word in rhythm; the enemy attacks back only on
   your misses, never on a hidden timer.
4. **Catch** — weaken a wild monster, then throw on a `good`/`great`/`perfect`
   hit.
5. **Train and evolve** — accumulated XP levels a monster up; evolution is
   derived from XP, not a separate minigame.
6. **Reach the cave boss** and clear the route. Progress (collection, XP, route
   clears) is saved to `localStorage`, so a refreshed tab resumes.

## Tests

The domain layer is pure and dependency-free:

```sh
node tests/run.mjs        # exits non-zero on failure
```

Verified state: **89 passed, 0 failed** (exit 0). The suite covers the monster
registry, the route/encounter tables, capture odds, XP/levels, the overworld
tile logic, and the save-file schema.

There is also a scripted in-browser smoke run that drives the whole arc:

```
http://localhost:8000/demo/index.html?autoplay=1
```

It walks world -> encounter -> victory -> XP/save -> node-clear -> world -> a
second battle and reports `AUTOPLAY-DONE 33/33` with no failures — useful as a
served-surface check after any deploy.

---

## Built on Typejoy

Typemon is a **consumer** of the Typejoy framework — it composes the framework's
`createSession()` API and `GamePlugin` hook set and never extends or patches it.

- Framework: **Typejoy** — https://github.com/ahrazzle/typejoy
- The pinned copy used by the demo lives at `demo/vendor/typejoy.js` and is
  redistributed **unmodified**.
  sha256 `26c6cc78130da271117fb20c170bee147d6698dd7f60a4404a92ef77b7292893`
- Typejoy is the work of its own authors and remains under its own license; this
  repository claims no ownership of it. See the upstream repository for its
  license and terms.

## Original Typemon content

All **Typemon** monsters, move names, and typing rules; the story and route; the
art direction; the game code; and the UI are original work created for this
project. No Pokémon, Showdown, or other third-party species, moves, stats, or
sprites are copied or referenced — the only third-party material in the repo is
the asset island described below, plus the unmodified Typejoy vendor copy.

## Licensing — two layers, one boundary

| Path | License |
|---|---|
| Everything except `assets/ccbysa/**` | **MIT** — see [`LICENSE`](LICENSE) |
| `assets/ccbysa/**` | **CC BY-SA 4.0** — see [`assets/ccbysa/LICENSE`](assets/ccbysa/LICENSE) |

`assets/ccbysa/**` is a third-party asset island (monster sprite art, type
icons, and battle backgrounds) sourced from
[OpMonTeam/OpMon-Data](https://github.com/OpMonTeam/OpMon-Data) and licensed
under **Creative Commons Attribution-ShareAlike 4.0 International**. It ships
*beside* the MIT engine as a distinct layer, and it is deliberately licensed
separately:

- **Attribution:** the per-file SHA-1 ledger is
  [`assets/ccbysa/ATTRIBUTION.md`](assets/ccbysa/ATTRIBUTION.md).
- **Share-alike:** any adaptation or redistribution of those files must stay
  under CC BY-SA 4.0 and keep that attribution. Do not relicense them as MIT.
- **Independence:** original Typemon content never references that island — the
  build asserts that no original monster points into `assets/ccbysa/**`.
- **One exception:** the single shipped audio track
  `assets/ccbysa/audio/8bit-battle.ogg` is **CC0-1.0** (public-domain
  dedication, credit Ted Kerr / Wolfgang_), not CC BY-SA.

If you reuse this repository, treat the `assets/ccbysa/**` folder under
CC BY-SA 4.0 and everything else under MIT.

## Hosting on GitHub Pages (repo-subpath safe)

The demo is written to work when served from a **repository subpath**, e.g.
`https://<user>.github.io/<repo>/`, not only from a domain root. All references
inside `demo/index.html` are relative (`./vendor/typejoy.js`,
`../assets/ccbysa/...`); there are no absolute `/...` paths and no `file://`
URLs, so the pages resolve correctly under a subpath.

- Publish from the repository root and open `<site>/demo/` to play.
- Keep `demo/index.html` and `demo/vendor/` together: the vendor import is
  relative to the page.
- Asset paths are prefixed `../` relative to the page, so moving
  `demo/index.html` to a different depth will break the assets — keep the
  folder structure or adjust the prefix.
- The served `demo/index.html` ships cache-busting meta; after a deploy, confirm
  the live bytes match the committed file before trusting a stale cached page.
