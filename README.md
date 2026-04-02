# Blackjack Training Software

A blackjack training application built with Python and the Arcade library. Designed to help players learn basic strategy, card counting (Hi-Lo), and bet spreading.

## Game Modes

### Play Blackjack
Full blackjack game with configurable table rules. Features:
- Configurable rules: number of decks, H17/S17, 3:2 or 6:5 blackjack, double, split, DAS, surrender, insurance
- Hit, Stand, Double Down, and Surrender actions
- Keyboard shortcuts for fast play (H/S/D/R, arrow keys for betting)
- Smooth card deal animations from shoe
- Shoe indicator showing cards remaining and approximate decks left
- Chip management, bet sizing, and hand statistics

### Strategy Trainer
Rapid-fire basic strategy practice. No betting — just decisions:
- Hands dealt automatically, one after another
- Choose the correct basic strategy play (Hit/Stand/Double/Split/Surrender)
- Instant feedback: green for correct, red with the right answer for incorrect
- Auto-advances after 1.5 seconds (or press any key to skip)
- Session and lifetime accuracy tracking (persisted to `strategy_stats.json`)
- Stats broken down by hand type: hard, soft, pair

### Counting Trainer
Practice Hi-Lo card counting on a simulated multi-seat casino table:
- Configurable: number of decks, player seats (1-7), deal speed, poll frequency
- Cards dealt to multiple seats in a semi-circular casino table layout
- Periodically pauses to ask for the running count
- Scores exact matches and close answers (within +/-1)
- Pause/resume with Space bar

### Strategy Tables
View color-coded basic strategy charts that adjust to any ruleset:
- Hard totals, soft totals, and pairs tables
- Actions: Hit (red), Stand (green), Double (blue), Split (yellow), Surrender (purple)
- Change rules on the fly to see how strategy adjusts
- Accessible from home screen or during gameplay (press T)

## Project Structure

```
blackjack.py          — Entry point
models.py             — Game logic: Rules, Card, Deck, Hand, Player, Round, Game
basic_strategy/       — Strategy table data and lookup
  tables.py           — H17/S17 tables, resolve composite actions, lookup_action()
views/                — Arcade views (one file per view)
  common.py           — Shared constants, styles, helpers
  home.py             — Main menu
  rules.py            — Pre-game rules configuration
  game.py             — Blackjack game table
  strategy.py         — Strategy chart viewer
  strategy_trainer.py — Rapid-fire strategy practice
  strategy_trainer_config.py — Config for strategy trainer
  counting_trainer.py — Counting practice game
  counting_trainer_config.py — Config for counting trainer
  options.py          — Options (placeholder)
  credits.py          — Credits
cards/                — PNG card assets (100x140)
tests/                — pytest test suite
```

## Requirements

- Python 3.10+
- arcade >= 3.3

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
