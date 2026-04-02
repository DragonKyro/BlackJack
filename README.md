# Blackjack Training Software

A blackjack training application built with Python and the Arcade library. Designed to help players learn basic strategy, card counting, and bet spreading.

## Features

- Full blackjack game with standard rules (6-deck shoe, dealer hits soft 17)
- Hit, Stand, and Double Down actions
- Hi-Lo card counting system with running/true count tracking
- Chip management and bet sizing
- Hand history and win/loss/push statistics
- Card images rendered as sprites

## Project Structure

- `blackjack.py` — Entry point
- `models.py` — Game logic (Card, Deck, Hand, Player, Round, Game)
- `views.py` — Arcade views (Home, Game, Options, Credits)
- `cards/` — Card image assets (100x140 PNG)

## Requirements

- Python 3.10+
- arcade 3.x

## Setup

```bash
pip install arcade
python blackjack.py
```

## Planned Features

- Basic strategy training mode with feedback
- Card counting practice drills
- Bet spread recommendations based on true count
- Configurable rules (number of decks, S17/H17, etc.)
- Split hands
- Insurance/surrender
