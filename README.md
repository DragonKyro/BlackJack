# Blackjack Training Software

A comprehensive blackjack training application built with Python and the Arcade library. Designed to help players master basic strategy, Hi-Lo card counting, and bet spreading through focused practice modes and detailed performance analytics.

## Game Modes

### Play Blackjack
Full blackjack game with configurable table rules:
- Configurable rules: number of decks, H17/S17, 3:2 or 6:5 blackjack, double, split, DAS, surrender, insurance, penetration
- Hit, Stand, Double Down, and Surrender actions
- Keyboard shortcuts for fast play (H/S/D/R, arrow keys for betting)
- Smooth card deal animations from shoe
- Shoe indicator showing cards remaining and approximate decks left
- Chip management, bet sizing, and hand statistics

### Strategy Trainer
Rapid-fire basic strategy practice — no betting, just decisions:
- Deal modes: Random, Hard only, Soft only, Pairs only, Smart (weighted toward weak spots)
- Choose the correct basic strategy play (Hit/Stand/Double/Split/Surrender)
- Instant feedback: green for correct, red with the right answer for incorrect
- Auto-advances after 1.5 seconds (or press any key to skip)
- Session and lifetime accuracy tracking persisted to disk
- Stats broken down by hand type: hard, soft, pair

### Counting Trainer
Practice Hi-Lo card counting on a simulated multi-seat casino table:
- Configurable: number of decks, player seats (1-7), deal speed, poll frequency
- Cards dealt to multiple seats in a semi-circular casino table layout
- Periodically pauses to ask for the running count
- Scores exact matches and close answers (within +/-1)
- Pause/resume with Space bar

### Smart Trainer
The full combined training experience — count, bet, and play all validated:
- Between rounds: input your running count and bet in units
- TC validated against actual count, bet validated against configured spread
- Play your hand with H/S/D/R — every action checked against basic strategy
- Three independent accuracy scores tracked: TC, Bets, Play
- Configurable rules and bet spread

### Bet Trainer
Practice counting and bet sizing — hands play themselves via basic strategy:
- Multi-seat casino table with animated card dealing
- Between rounds: input running count and bet (validated against spread)
- All seats auto-play according to basic strategy
- Tracks bet accuracy and TC accuracy separately

### Strategy Tables
View color-coded basic strategy charts that adjust to any ruleset:
- Hard totals, soft totals, pairs, and deviation tables (Illustrious 18 + Fab 4)
- Actions: Hit (red), Stand (green), Double (blue), Split (yellow), Surrender (purple)
- Change rules on the fly to see how strategy adjusts
- Accessible from home screen or during gameplay (press T)

### Bet Spread Analyzer
Model different bet spreads and calculate expected value:
- Interactive spread editor: set bet units per true count (-5 to +10)
- Live-updating results: EV/hour, SD/hour, risk of ruin, N0 break-even point
- Configurable: decks, penetration, unit size, bankroll, hands/hour
- Preset spreads: 1-12 (aggressive), 1-8 (conservative), Flat

### Stats & Analytics
Track training performance with rich visualizations:
- **Summary**: overall accuracy, per-type breakdown, recent trends
- **Heatmap**: error-rate overlay on the basic strategy grid (matplotlib) — instantly see weak spots
- **Trend graph**: rolling 20-hand accuracy line chart (matplotlib)
- **Interactive report**: press B to open a full Plotly dashboard in the browser with heatmaps, bar charts, and rolling accuracy — fully interactive with hover/zoom

## Project Structure

```
blackjack.py             — Entry point
models.py                — Game logic: Rules, Card, Deck, Hand, Player, Round, Game
utils/                   — Math and analytics modules
  bet_spread.py          — Bet spread analysis: EV, SD, risk of ruin, TC frequency
  stats_analytics.py     — Pandas calculations, matplotlib charts, Plotly HTML reports
basic_strategy/          — Strategy table data and lookup
  tables.py              — H17/S17 tables, composite action resolution, deviations
views/                   — Arcade views package (one file per view)
  common.py              — Shared constants, styles, helpers (make_button, make_cycle_row)
  home.py                — Main menu
  rules.py               — Pre-game rules configuration (reusable with callbacks)
  game.py                — Blackjack game table with animations
  strategy.py            — Strategy chart viewer (4 tabs incl. deviations)
  strategy_trainer_config.py — Config for strategy trainer
  strategy_trainer.py    — Rapid-fire strategy practice
  smart_trainer_config.py — Config for smart trainer
  smart_trainer.py       — Combined count + bet + play trainer
  bet_trainer_config.py  — Config for bet trainer
  bet_trainer.py         — Count + bet trainer with auto-play
  counting_trainer_config.py — Config for counting trainer
  counting_trainer.py    — Hi-Lo counting practice on simulated table
  bet_spread.py          — Bet spread analyzer with live EV calculations
  stats.py               — Stats viewer with matplotlib charts + Plotly report
  options.py             — Options (placeholder)
  credits.py             — Credits
cards/                   — PNG card assets (100x140)
tests/                   — pytest test suite
```

## Requirements

- Python 3.10+
- arcade >= 3.3
- numpy, pandas, matplotlib, plotly, kaleido

## Setup

```bash
conda activate arcade
pip install -r requirements.txt
python blackjack.py
```

## Testing

```bash
conda activate arcade
python -m pytest tests/ -v
```
