# Blackjack Training Software

## Overview
Blackjack training app using Python + Arcade 3.x. Six game/training modes, strategy chart viewer, bet spread analyzer, and performance analytics.

## Architecture
- `models.py` — Pure game logic, no rendering. Classes: Rules (dataclass), Card, Deck, Hand, Player, Round, Game.
- `utils/` — Math and analytics modules.
  - `bet_spread.py` — BetSpread (dataclass), TC frequency distributions, base_house_edge(), player_edge_at_tc(), analyze_bet_spread() → BetSpreadResults (EV, SD, RoR, N0).
  - `stats_analytics.py` — Analytics powered by pandas/matplotlib/plotly. compute_summary(), render_heatmap(), render_trend() → PNG bytes, generate_plotly_report() → opens HTML in browser.
- `basic_strategy/` — Strategy table data and lookup logic.
  - `tables.py` — H17/S17 tables for hard, soft, pairs. Composite action resolution (D/Ds/Rh/Rs/Ph/Rp). Illustrious 18 + Fab 4 deviation tables. `get_strategy_tables(rules)`, `lookup_action(rules, hand, dealer_rank)`, `get_deviations()`.
- `views/` — Arcade views package. Each view in its own file:
  - `common.py` — Shared constants, styles, helpers (SCREEN_WIDTH, make_button, make_cycle_row, texture cache, ARROW_STYLE, TOGGLE_ON/OFF_STYLE).
  - `home.py` — HomeView (main menu with all modes).
  - `rules.py` — RulesView (pre-game rules config, reusable with `on_start_callback` and `start_label`).
  - `game.py` — GameView (main blackjack table + card animations + shoe indicator).
  - `strategy.py` — StrategyView (4 tabs: Hard, Soft, Pairs, Deviations; rules-aware).
  - `strategy_trainer_config.py` — Config for strategy trainer (deal mode, rules).
  - `strategy_trainer.py` — StrategyTrainerView (rapid-fire practice, targeted dealing, persistent stats).
  - `smart_trainer_config.py` — Config for smart trainer.
  - `smart_trainer.py` — SmartTrainerView (combined: count + bet + play, all validated).
  - `bet_trainer_config.py` — Config for bet trainer.
  - `bet_trainer.py` — BetTrainerView (count + bet practice, auto-play via basic strategy).
  - `counting_trainer_config.py` — Config for counting trainer.
  - `counting_trainer.py` — CountingTrainerView (Hi-Lo practice on simulated multi-seat table).
  - `bet_spread.py` — BetSpreadView (interactive spread editor + live EV/RoR).
  - `stats.py` — StatsView (Summary, Heatmap, Trend tabs; lazy matplotlib→texture rendering; Plotly browser report).
  - `options.py` — OptionsView (placeholder).
  - `credits.py` — CreditsView.
- `blackjack.py` — Entry point. Creates arcade Window and launches HomeView.
- `cards/` — PNG card assets (100x140), named `{rank}{suit}.png`.
- `strategy_stats.json` — Persisted strategy trainer performance (auto-created, gitignored).
- `tests/` — pytest suite covering models, basic_strategy, and trainer stats.

## Conventions
- Game logic and rendering are strictly separated (models vs views).
- Card ranks: `2`-`10`, `j`, `q`, `k`, `a`. Suits: `c`, `d`, `h`, `s`.
- All game rules configured via `Rules` dataclass, threaded through `Game` → `Round` → `Player`.
- Views use lazy imports (`from views.X import Y` inside methods) to avoid circular dependencies.
- Hi-Lo count: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1.
- Use `arcade.Text` objects for all text rendering (not `arcade.draw_text`). Create once in `__init__`, update `.text`, call `.draw()` in `on_draw`.
- GameView action buttons anchored at consistent bottom position (`_ACTION_BAR_Y`) across all states.
- Card animations: `_CardAnim` objects with ease-out quadratic easing, processed in `on_update`. State='animating' blocks input.
- Config screens use `make_cycle_row()` from common.py for `◀ value ▶` controls.
- RulesView supports `on_start_callback` for reuse (StrategyView passes callback to update tables).
- Stats charts rendered lazily: matplotlib → PNG bytes → PIL Image → arcade.Texture. Only rendered when the tab is first viewed, cached until data changes.

## Game Modes

### Play Blackjack
- Flow: HomeView → RulesView → GameView.
- Keyboard: Betting (Enter=deal, arrows=adjust bet, T=strategy), Playing (H/S/D/R, T=strategy), Result (Enter/Space=next, Esc=menu).
- Shoe indicator (top-right): cards remaining, decks remaining, color bar.

### Strategy Trainer
- Flow: HomeView → StrategyTrainerConfigView → StrategyTrainerView.
- Deal modes: Random, Hard, Soft, Pairs, Smart (weighted by error history).
- Rapid-fire: deal → pick action → feedback → auto-deal after 1.5s.
- Stats persisted to `strategy_stats.json`: total, correct, by_type, last 2000 history entries with dealer_rank.
- Keyboard: H/S/D/P/R, any key to skip feedback, Esc to exit.

### Counting Trainer
- Flow: HomeView → CountingTrainerConfigView → CountingTrainerView.
- Config: num_decks, num_seats (1-7), deal_speed (0.3-3.0s), poll_freq (every N cards).
- Semi-circular casino table layout. Cards animate from shoe to seats.
- Keyboard: digits + Enter to answer, Space to pause/resume, Esc to exit.

### Smart Trainer
- Flow: HomeView → SmartTrainerConfigView → SmartTrainerView.
- Combined: user inputs RC + bet → deal with animation → user plays hand → dealer auto-plays.
- All three validated: TC accuracy, bet vs spread, play vs basic strategy.
- Three independent score trackers in top-right.

### Bet Trainer
- Flow: HomeView → BetTrainerConfigView → BetTrainerView.
- Multi-seat table, user inputs RC + bet, hands auto-play via basic strategy.
- Validates TC and bet, tracks both accuracy scores.

### Bet Spread Analyzer
- Flow: HomeView → BetSpreadView.
- Left panel: TC spread table (↑↓ select, ←→ adjust bet units).
- Right panel: live EV/hr, SD/hr, RoR, N0. Presets: 1-12, 1-8, Flat.
- Bottom: configurable decks, penetration, unit size, bankroll, hands/hour.

### Strategy Tables
- Flow: HomeView → StrategyView (or press T in-game).
- 4 tabs: Hard, Soft, Pairs (color-coded grid), Deviations (Illustrious 18 + Fab 4).
- Rules button opens RulesView with callback to update tables.

### Stats & Analytics
- Flow: HomeView → StatsView.
- Tab 1 (Summary): text stats via pandas compute_summary().
- Tab 2 (Heatmap): matplotlib error-rate heatmap over strategy grid (Q/W to switch hard/soft/pairs).
- Tab 3 (Trend): matplotlib rolling 20-hand accuracy line chart.
- B key: opens interactive Plotly HTML report in browser (6-panel dashboard).
- Clear Stats button resets everything.

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
