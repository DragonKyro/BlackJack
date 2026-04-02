# Blackjack Training Software

## Overview
Blackjack training app using Python + Arcade 3.x. Teaches basic strategy, card counting (Hi-Lo), and bet spreading.

## Architecture
- `models.py` — Pure game logic, no rendering. Classes: Card, Deck, Hand, Player, Round, Game.
- `views.py` — Arcade views and GUI. Classes: HomeView, GameView, OptionsView, CreditsView.
- `blackjack.py` — Entry point. Creates arcade Window and launches HomeView.
- `cards/` — PNG card assets (100x140), named `{rank}{suit}.png` (e.g., `ac.png`, `10h.png`, `ks.png`, `cardback.png`).

## Conventions
- Game logic and rendering are strictly separated (models vs views).
- Card ranks: `2`-`10`, `j`, `q`, `k`, `a`. Suits: `c`, `d`, `h`, `s`.
- Deck uses 6-deck shoe by default, reshuffles at 75% penetration.
- Dealer hits soft 17.
- Hi-Lo count: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1.

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
