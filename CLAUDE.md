# Blackjack Training Software

## Overview
Blackjack training app using Python + Arcade 3.x. Teaches basic strategy, card counting (Hi-Lo), and bet spreading.

## Architecture
- `models.py` — Pure game logic, no rendering. Classes: Rules, Card, Deck, Hand, Player, Round, Game.
- `views/` — Arcade views package. Each view in its own file:
  - `common.py` — Shared constants, styles, helpers (SCREEN_WIDTH, make_button, etc.).
  - `home.py` — HomeView (main menu).
  - `rules.py` — RulesView (pre-game rules config).
  - `game.py` — GameView (main blackjack table + animations).
  - `strategy.py` — StrategyView (basic strategy tables, color-coded).
  - `options.py` — OptionsView (placeholder).
  - `credits.py` — CreditsView.
- `basic_strategy/` — Strategy table data and lookup logic.
  - `tables.py` — H17/S17 tables for hard, soft, pairs. `get_strategy_tables(rules)` resolves composite actions. `lookup_action(rules, hand, dealer_rank)` for single lookups.
- `blackjack.py` — Entry point. Creates arcade Window and launches HomeView.
- `cards/` — PNG card assets (100x140), named `{rank}{suit}.png` (e.g., `ac.png`, `10h.png`, `ks.png`, `cardback.png`).

## Conventions
- Game logic and rendering are strictly separated (models vs views).
- Card ranks: `2`-`10`, `j`, `q`, `k`, `a`. Suits: `c`, `d`, `h`, `s`.
- All game rules are configured via the `Rules` dataclass and threaded through `Game` → `Round` → `Player`.
- Configurable rules: num_decks, penetration, dealer_hits_soft_17, blackjack_payout (3:2 or 6:5), allow_double, allow_split, allow_double_after_split, allow_surrender, allow_insurance, min_bet.
- Flow: HomeView → RulesView (configure table rules) → GameView (play). StrategyView accessible from Home (button) or in-game (T key).
- Views use lazy imports (`from views.X import Y` inside methods) to avoid circular dependencies.
- Hi-Lo count: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1.
- Use `arcade.Text` objects for all text rendering (not `arcade.draw_text`). Create them once in `__init__`, update `.text` property for dynamic content, call `.draw()` in `on_draw`.
- GameView action buttons always anchored at consistent bottom position (`_ACTION_BAR_Y`) across all states.
- Keyboard shortcuts: Betting (Enter=deal, arrows=adjust bet), Playing (H=hit, S=stand, D=double, R=surrender), Result (Enter/Space=next, Esc=menu).
- Card animations use `_CardAnim` objects processed in `on_update` with ease-out quadratic easing. During animation, state='animating' and input is blocked.

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
