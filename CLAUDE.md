# Blackjack Training Software

## Overview
Blackjack training app using Python + Arcade 3.x. Three game modes: Play Blackjack, Strategy Trainer, Counting Trainer. Plus a strategy chart viewer.

## Architecture
- `models.py` — Pure game logic, no rendering. Classes: Rules (dataclass), Card, Deck, Hand, Player, Round, Game.
- `views/` — Arcade views package. Each view in its own file:
  - `common.py` — Shared constants, styles, helpers (SCREEN_WIDTH, make_button, texture cache, etc.).
  - `home.py` — HomeView (main menu with all game modes).
  - `rules.py` — RulesView (pre-game rules config, reusable with callback).
  - `game.py` — GameView (main blackjack table + card animations + shoe indicator).
  - `strategy.py` — StrategyView (color-coded basic strategy tables, rules-aware).
  - `strategy_trainer_config.py` — Config screen for strategy trainer.
  - `strategy_trainer.py` — StrategyTrainerView (rapid-fire basic strategy practice).
  - `counting_trainer_config.py` — Config screen for counting trainer.
  - `counting_trainer.py` — CountingTrainerView (Hi-Lo counting practice on simulated table).
  - `options.py` — OptionsView (placeholder).
  - `credits.py` — CreditsView.
- `basic_strategy/` — Strategy table data and lookup logic.
  - `tables.py` — H17/S17 tables for hard, soft, pairs. `get_strategy_tables(rules)` resolves composite actions (D/Ds/Rh/Rs/Ph/Rp). `lookup_action(rules, hand, dealer_rank)` for single lookups.
- `blackjack.py` — Entry point. Creates arcade Window and launches HomeView.
- `cards/` — PNG card assets (100x140), named `{rank}{suit}.png` (e.g., `ac.png`, `10h.png`, `ks.png`, `cardback.png`).
- `strategy_stats.json` — Persisted strategy trainer performance (auto-created on first use).
- `tests/` — pytest suite covering models, basic_strategy, and trainer stats.

## Conventions
- Game logic and rendering are strictly separated (models vs views).
- Card ranks: `2`-`10`, `j`, `q`, `k`, `a`. Suits: `c`, `d`, `h`, `s`.
- All game rules are configured via the `Rules` dataclass and threaded through `Game` → `Round` → `Player`.
- Configurable rules: num_decks, penetration, dealer_hits_soft_17, blackjack_payout (3:2 or 6:5), allow_double, allow_split, allow_double_after_split, allow_surrender, allow_insurance, min_bet.
- Views use lazy imports (`from views.X import Y` inside methods) to avoid circular dependencies.
- Hi-Lo count: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1.
- Use `arcade.Text` objects for all text rendering (not `arcade.draw_text`). Create them once in `__init__`, update `.text` property for dynamic content, call `.draw()` in `on_draw`.
- GameView action buttons always anchored at consistent bottom position (`_ACTION_BAR_Y`) across all states.
- Card animations use `_CardAnim` objects processed in `on_update` with ease-out quadratic easing. During animation, state='animating' and input is blocked.
- RulesView supports `on_start_callback` for reuse (e.g., StrategyView passes a callback to update tables instead of starting a game).

## Game Modes

### Play Blackjack
- Flow: HomeView → RulesView → GameView.
- Keyboard: Betting (Enter=deal, arrows=adjust bet, T=strategy), Playing (H=hit, S=stand, D=double, R=surrender, T=strategy), Result (Enter/Space=next, Esc=menu).
- Shoe indicator (top-right): cards remaining, decks remaining, color bar.

### Strategy Trainer
- Flow: HomeView → StrategyTrainerConfigView → StrategyTrainerView.
- Rapid-fire hands: deal → player picks action → feedback (correct/incorrect) → auto-deal after 1.5s.
- Uses `lookup_action()` from basic_strategy to check answers.
- Stats persisted to `strategy_stats.json`: total, correct, by_type (hard/soft/pair), last 500 history entries.
- Keyboard: H/S/D/P/R for actions, any key to skip feedback timer, Esc to exit.

### Counting Trainer
- Flow: HomeView → CountingTrainerConfigView → CountingTrainerView.
- Config: num_decks, num_seats (1-7), deal_speed (0.3-2.0s), poll_freq (every N cards).
- Simulates multi-seat casino table with semi-circular layout.
- Cards dealt one at a time at configured speed, seats play simple sim (hit <17).
- Periodically pauses to ask for running count; scores exact/close/wrong.
- Keyboard: digits + Enter to answer, Space to pause/resume, Esc to exit.

## Environment
- Conda environment: `arcade`
- Activate before running: `conda activate arcade`

## Running
```bash
conda activate arcade
python blackjack.py
```

## Testing
```bash
conda activate arcade
python -m pytest tests/ -v
```
