# Blackjack Trainer

A blackjack training web app: basic strategy, Hi-Lo card counting and bet sizing, drilled one at a time and then put together at a full table. It runs in the browser on a phone or a computer, works offline once loaded, and can sync your training record between devices when you sign in with Google.

**Play it:** https://dragonkyro.github.io/BlackJack/

## Modes

### Play Blackjack
A full table with a bankroll that persists between visits.
- Configurable rules: decks, penetration, H17/S17, 3:2 or 6:5, double, split (to four hands; split aces get one card), double after split, late surrender, insurance, table minimum.
- Hit, stand, double, split, surrender, insurance and even money. The dealer peeks for blackjack.
- Up to four other players, who play basic strategy, so there are more cards to count.
- A coach that flags any play that isn't basic strategy, plus an optional running/true count readout.
- Cards are dealt from the shoe with flips, the hole card is turned over, cards sweep to the discard tray, and chips pay out.
- Press **T** at any table to see the strategy chart with your hand's cell highlighted.

### Strategy Trainer
Rapid-fire basic strategy with no betting.
- Deal modes: Random, Hard, Soft, Pairs, and Smart, which weights every chart cell toward the ones you miss or haven't seen.
- Instant feedback, auto-deal after 1.5 s (any key skips ahead), streaks, and session and lifetime accuracy.

### Counting Trainer
A table of 1–7 seats plays itself at your chosen speed (0.3–3 s per card).
- Every N cards it stops and asks for the running count.
- Answers are scored as exact or within ±1. Pause and resume with Space.
- The count resets on a new shoe.

### Bet Trainer
Before each round you give the count and your bet in units, then the hands play themselves by basic strategy.
- You can give the true count, or the running count for an easier drill.
- Both the count and the bet are graded against the cards seen and your bet spread. The feedback shows the arithmetic, e.g. RC +7 ÷ 3.5 decks = TC +2.

### Smart Trainer
Everything at once: count, bet, then play your own hand. All three are graded.
- Plays can be graded against basic strategy, or against the Illustrious 18 + Fab 4 index plays at the current true count.
- Insurance is graded too.

### Strategy Charts
Colour-coded hard, soft and pair charts that adjust to the rules, plus the Illustrious 18 and Fab 4 index plays.

### Bet Spread Analyzer
Edit a spread unit by unit, from TC −7 to +10, and see live results:
- EV and SD per hour, risk of ruin, N0, average bet, and the bankroll needed for 5% or 1% risk of ruin.
- The true-count distribution is computed from the deck count, penetration and your TC rounding.
- Save the spread and the trainers can use it.

### Stats & Analytics
- Accuracy overall, by hand type, and by dealer up card.
- An error-rate heatmap over the strategy grid, plus your biggest leaks with a one-tap "drill these".
- A rolling 20-decision accuracy trend, and a list of every trainer and table session.

## Keyboard

| Where | Keys |
| --- | --- |
| Any table | **H** hit · **S** stand · **D** double · **P** split · **R** surrender · **T** strategy chart · **Esc** back |
| Play | **Enter** deal / next hand · **←/→** bet ± a minimum · **C** clear the bet · **Y/N** insurance |
| Strategy trainer | any key: next hand |
| Counting trainer | digits, **−**, **Enter** to answer · **Space** pause / continue |
| Bet / Smart trainers | digits, **−**, **Tab** between count and bet, **Enter** submit / deal |
| Charts, Stats | **←/→** (or **Q/W**) switch tabs |

## Tech

TypeScript, React 19, Vite 6, Zustand, and Vitest. Cards and chips are drawn in code as SVG, and the sounds are synthesized with Web Audio. It's an offline-capable PWA (vite-plugin-pwa). Firebase Auth and Firestore load lazily, only when you sign in. The project is laid out like [Bridge Master](https://github.com/DragonKyro/Bridge-Master) and shares its card art and Firebase project.

## Develop

```bash
npm install        # then: npm run fix-lock (see CLAUDE.md)
npm run dev        # http://localhost:5173/BlackJack/
npm run test:run   # unit tests
npm run build      # typecheck + production build + service worker
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`, which runs the tests and builds first.

## Firebase

Stats sync uses the shared Firebase project `github-games-e7c7d`. Each user gets one Firestore document, `blackjack/{uid}`, and only that user can read or write it. The rules are in `firestore.rules`. They are the whole project's rule set, so they also carry Bridge Master's block. Deploy them with `npm run deploy:rules`.
