# CLAUDE.md

Context for Claude working in this repo.

## What this is

Blackjack Trainer: a static web app for GitHub Pages (`https://dragonkyro.github.io/BlackJack/`), built to work on a phone and on desktop. Five modes:
- **Play:** a full table with a persistent bankroll, a coach, and optional basic-strategy players.
- **Strategy trainer:** rapid-fire decisions; Smart mode weights the cells you miss.
- **Counting trainer:** a 1–7 seat table plays itself and quizzes the running count every N cards.
- **Bet trainer:** give the count and the bet each round; the hands play themselves.
- **Smart trainer:** count, bet and play, all graded, optionally against index plays.

Plus strategy charts (with the I18 and Fab 4), a bet spread analyzer, and stats (summary, error heatmap, trend, sessions). Single player.

Training records are saved locally and synced through Firestore when signed in with Google. The app works offline (PWA). The old Python/arcade app was removed and lives in git history before the web rewrite. The web app reimplements all of it, with its bugs fixed (see "Fixed from the desktop app").

## Tech stack

- TypeScript, Vite 6, React 19, Zustand, Vitest.
- Firebase (Auth with Google + Firestore), lazy-loaded.
- `vite-plugin-pwa` (Workbox) for offline.
- Cards and chips are drawn in code: `src/ui/cards/cardArt.ts` is shared with Bridge Master (from `../tractor`) and has a blackjack card back; `src/ui/chips/chipArt.ts`. There are no image assets besides the app icons.
- Fonts are self-hosted via @fontsource (Inter, Playfair Display).
- Sounds are synthesized with Web Audio (`src/ui/sounds.ts`).

## Commands

- `npm run dev` · `npm run build` (tsc + vite build + service worker) · `npm run preview`
- `npm run test:run` runs all tests. `npx tsc --noEmit -p .` typechecks.
- `npm run fix-lock`: **run after any `npm install` that changes package-lock.json.** This machine installs through a corporate Artifactory mirror (`NPM_CONFIG_REGISTRY`), which writes mirror URLs into the lockfile, and GitHub Actions can't reach them. The script points every `resolved` URL back at registry.npmjs.org (integrity hashes stay valid). The lockfile must contain no `drwholdings` URLs.
- `npm run deploy:rules` deploys `firestore.rules`. **Confirm with the user first (shared project).**
- `node scripts/make-icons.mjs` redraws every icon. The tab favicon is a simplified art (one bold A♠ plus the red "21" chip) as `favicon.svg`, `favicon-32.png` and `favicon.ico` (PNG-in-ICO, 16/32/48). The PWA and home-screen PNGs use the full art (A♠ and K♥ fanned with the chip). It rasterises with the local Chrome; set `CHROME` if it isn't found.

## Architecture

Import directions: `ui → store → bj / strategy / math`. `net` is used by the store wiring (`main.tsx`) and the UI only. Path alias `@/` → `src/`.

- **`src/bj/`: pure blackjack.**
  - `cards.ts`: a card is rank + suit, `'AS'`, `'TH'`; values; Hi-Lo tags; up-card columns `'2'…'10','A'`; seeded RNG.
  - `hand.ts`: totals, soft, natural, pair, dealer draw rule.
  - `rules.ts`: the `Rules` type, defaults, labels, `MAX_HANDS = 4`.
  - `shoe.ts`: an immutable shoe (shared card array plus `pos` / `rc` / `cut` / `gen`); `draw`; `decksLeft` rounded to the half deck, min ½; `intTrueCount` with `round` (half away from zero) | `floor` | `truncate`.
  - `table.ts`: the engine (see below).
- **`src/strategy/`.**
  - `tables.ts`: H17/S17 hard, soft and pair charts as raw codes (D/Ds/Ph/Rh/Rs/Rp). It provides:
    - `bestAction(rules, cards, up, options)`, which resolves the codes against what the hand can actually do (2 cards? after a split? max hands?). Unsplittable pairs play their total, and soft 12 always hits.
    - `charts(rules)` for display.
    - `classify` (stats type and row).
    - `DEVIATIONS` (I18 + Fab 4) and `indexAction(…, tc)`.
  - `deal.ts`: strategy-trainer dealing by mode; Smart weights each (type, row, up) cell by `0.5 + 10·(wrong+½)/(n+1)`.
- **`src/math/`.**
  - `betSpread.ts`: the spread analysis. It keeps the desktop app's rule-effect house edge, +0.5%/TC, SD 1.15/unit, RoR = e^(−2·EV·B/var), and N0 = var/EV². The TC *distribution* is computed, not tabled: the RC after n of N cards is ~normal with variance n·(10/13)·(N−n)/(N−1), rounds are spread over the cards before the cut, and each integer RC is bucketed with the trainers' own `toIntTc`.
  - `analytics.ts`: summary, heatmap, rolling, byUpCard, leaks, cellStats.
  - `spreadView.ts` / `statsView.ts`: view helpers for the analyzer and stats pages.
- **`src/store/`.**
  - `prefsStore`: sound, pace, four-colour, TC rounding, auto-deal.
  - `configStore`: each mode's setup, remembered.
  - `statsStore`: drills, sessions, play record, saved spread; merge and encode for the cloud.
  - `driver.ts`: runs a table's automatic steps on a timer; `stop()` cancels so nothing stale lands.
  - `playStore`, `strategyStore`, `countingStore`, `countBetStore` (Bet and Smart share it): one per mode.
  - `countCheck.ts`: `countOf`, grading the count and the bet.
  - `storage.ts`: localStorage, every key prefixed `blackjack.` (all of dragonkyro.github.io shares one origin).
- **`src/net/`.**
  - `firebaseConfig.ts`: the "BlackJack" web app in `github-games-e7c7d`.
  - `cloud.ts`: lazy Firebase; Google sign-in by popup; an offline queue of changed keys in localStorage, debounced pushes, and a full pull, merge and push on sign-in, `online` and start-up.
- **`src/ui/`.**
  - `App.tsx` + `router.ts`: hash routes `#/`, `#/<mode>` (setup), `#/<mode>/go`, `#/charts/<tab>`, `#/spread`, `#/stats/<tab>`.
  - `pages/`: Home, Setup (all five), PlayPage, StrategyTrainer, CountingTrainer, CountBetPage (+ BetTrainer / SmartTrainer wrappers), ChartsPage, SpreadPage, StatsPage, `modes.ts`.
  - `table/`:
    - `Felt` (rail, printed arcs, `Shoe`, `Discard`)
    - `Hands` (TotalBadge, CardRow, DealerArea, HandView, SeatView, ResultBadge)
    - `Seats` (arc layout)
    - `Chips`, `ActionBar`, `Checks`, `CountChip`
    - `anchors.ts`: the shoe and tray positions for flights
  - `cards/`: cardArt and `CardView` (`TableCard` flies in from the shoe, flips, and sweeps to the tray).
  - `charts/`: SVG Bars, Heatmap, TrendChart, SpreadChart.
  - `shared/`: controls (Toggle, Segmented, Cycle, Row, Modal, TopBar, useHotkeys, useTween), RulesEditor, StrategyGrid, StrategyPeek, Entry (count/bet keypad), Settings + Account, Icon.
  - `styles/`: theme, pages, table, trainers, charts (strategy charts + analyzer), stats.
- **`src/pwa.ts`** registers the service worker (production only). A new build reloads only away from a live table.

## The table engine (`src/bj/table.ts`)

Every mode drives one engine. A `Table` has seats (seat 0 is first base, dealt first, drawn on the right), each seat with hands (more after splits), plus the dealer, the shoe, a phase and the turn.

- **Phases:** `dealing → (insurance) → (peek) → playing → dealer → settle → done`.
- **`nextStep(t)`** returns the next automatic step, or null when the human must act (`waitingOnHuman`) or the round is done. The automatic steps are:
  - deal a card
  - an auto seat's basic-strategy play
  - the peek
  - reveal the hole card
  - a dealer hit
  - settle
- **`apply(t, step)`** performs one step. **`act` / `insure`** are the human's input. The stores' `createDriver` applies steps on a timer, so every card animates.
- **Rules modelled:**
  - US peek on an ace or ten; insurance and even money; late surrender only on the first two cards of an unsplit hand.
  - Splitting to four hands, with DAS optional; split aces take one card and can't be resplit.
  - A split 21 isn't a blackjack, and any hand reaching 21 stands.
  - The dealer doesn't draw when no live hands are left. Naturals are paid at once after the peek.
- **Counting:** `seenRc` / `unseen` / `seenCount` leave out the face-down hole card until it's turned. Every count check and the count readout use these.

## Data and Firebase (shared project)

Project `github-games-e7c7d` is shared with Bridge Master, tractor, catan, social-deduction and others.

- Data is **prefixed**: Firestore collection `blackjack`, localStorage keys `blackjack.*`.
- `firestore.rules` is the **whole project's** Firestore rule set, kept identical in `Bridge-Master/firestore.rules`. Change both, then deploy from either, after asking the user.
- Document `blackjack/{uid}` = `{ drills, sessions, play, spread, cleared, updated }`, written with `setDoc(…, { merge: true })`:
  - `drills: { id: "ts|mode|type|row|up|your|ans|tc" }`. One string per decision keeps the index-entry count and the document small (cap 3000).
  - `sessions: { id: "<json>" }` (cap 400).
  - `play`: the bankroll record. `spread: { units, at }`.
  - `cleared` (ms): a clear on any device drops older records everywhere.
- **Merge:** drills and sessions are unions by id (a session's later `end` wins); `play` and `spread` take the newest `at`. A full sync deletes remote ids that were trimmed or cleared locally.
- Google sign-in must be enabled, with `dragonkyro.github.io` listed under Authorized domains (already set up for Bridge Master).

## Session counters (`Session.n`)

- **counting:** polls, exact, close (±1, includes exact), absErr, cards, seats, decks, speedMs.
- **bet:** rounds, checks, checksOk, checksClose, bets, betsOk, net (units), askRc.
- **smart:** bet's counters plus plays and playsOk.
- **play:** hands, won, lost, pushed, blackjacks, net ($), plays, playsOk.

## Performance (dealing must stay smooth)

- **Cards at rest are flat.** A `TableCard` is one element with one image. Only while it turns over (flying in face up, or the hole card's reveal) does it get `.is-turning`: perspective, preserve-3d and both faces. Don't add `will-change`, permanent 3D or a second image to resting cards.
- **Card rows glide; they never jump.** `Felt`'s `useRowGlide` runs a FLIP after every commit on each `[data-flip]` row (`CardRow`), so a hand re-centring as a card lands, or hands moving after a split, slides into place. A split card slides across from where it was (`departed` in `CardView.tsx`) instead of flying from the shoe.
- **Animate only `transform` and `opacity`.** The shoe and tray fills use `scaleY`; the turn pulse is a scaling ring, not a `box-shadow` animation. No `mix-blend-mode` on the felt, because it re-composites under every flying card.
- **Keep re-renders small.** `CardRow`, `HandView`, `SeatView`, `DealerArea` and `TableCard` are memoised (pass primitives or stable objects); the bankroll count-up is its own leaf (`Bankroll`), so the tween doesn't re-render the table.
- **First-deal costs are moved to idle time.** The AudioContext is created while the page is idle (the first gesture only resumes it), noise buffers are cached, and `warmCards` decodes every card image a slice at a time after start-up.
- **Measuring:** in headless Chrome, sample `requestAnimationFrame` deltas and the landed cards' positions during a deal. The first rAF after an idle page shows a ~450 ms gap in headless even with no input, which is an artifact. Use `--disable-gpu` for screenshots (GPU-mode captures sometimes come out blank).

## Conventions

- State is plain JSON, and the engine is immutable (functions return new tables).
- Every animation has a `prefers-reduced-motion` fallback (global rule at the bottom of `theme.css`).
- Action colours are the same everywhere (charts, buttons, pills): `--act-H/S/D/P/R`. Suits are red/black by default; `.suits-four` turns on four colours.
- Keys come from `useHotkeys` (ignored while typing in a field, and Enter/Space stay with a focused button).
- Don't commit or push unless asked. Pushing `main` deploys (`.github/workflows/deploy.yml`: tests, build, Pages).

## Fixed from the desktop app

- Bet and Smart labelled the count field "Running Count" but graded it as a true count. Now you pick which one you're asked for.
- The heatmap and Smart dealing keyed cells on hand value, so A,A and 6,6 (both 12) collided. Drills now store the chart row.
- Smart dealing now weights per (hand, up card) cell; the desktop weighted by hand value only.
- A,A with splitting off was looked up as hard 12. It now plays as soft 12 and always hits.
- Composite chart codes now resolve on the hand's real options. A three-card soft 18 stands where the chart says Ds, and a pair that can't be split again plays its total.
- The analyzer's TC frequencies ignored penetration. They are now computed from the deck count, penetration and rounding.
- The counting trainer counted the hole card before it was seen, and its seats hit below 17 on raw totals. Seats now play basic strategy.
- Play mode had no splitting. It now splits to four hands, with DAS.
