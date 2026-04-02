# Blackjack Training Software

## Overview
Blackjack training app using Python + Arcade 3.x. Teaches basic strategy, card counting (Hi-Lo), and bet spreading.

## Architecture
- `models.py` — Pure game logic, no rendering. Classes: Rules, Card, Deck, Hand, Player, Round, Game.
- `views.py` — Arcade views and GUI. Classes: HomeView, RulesView, GameView, OptionsView, CreditsView.
- `blackjack.py` — Entry point. Creates arcade Window and launches HomeView.
- `cards/` — PNG card assets (100x140), named `{rank}{suit}.png` (e.g., `ac.png`, `10h.png`, `ks.png`, `cardback.png`).

## Conventions
- Game logic and rendering are strictly separated (models vs views).
- Card ranks: `2`-`10`, `j`, `q`, `k`, `a`. Suits: `c`, `d`, `h`, `s`.
- All game rules are configured via the `Rules` dataclass and threaded through `Game` → `Round` → `Player`.
- Configurable rules: num_decks, penetration, dealer_hits_soft_17, blackjack_payout (3:2 or 6:5), allow_double, allow_split, allow_double_after_split, allow_surrender, allow_insurance, min_bet.
- Flow: HomeView → RulesView (configure table rules) → GameView (play).
- Hi-Lo count: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1.
- Use `arcade.Text` objects for all text rendering (not `arcade.draw_text`). Create them once in `__init__`, update `.text` property for dynamic content, call `.draw()` in `on_draw`.

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
