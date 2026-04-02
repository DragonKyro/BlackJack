"""
Basic strategy tables for blackjack.

Actions:
  H  = Hit
  S  = Stand
  D  = Double if allowed, else Hit
  Ds = Double if allowed, else Stand
  P  = Split
  Ph = Split if DAS allowed, else Hit
  Pd = Split if DAS allowed, else Double
  Rh = Surrender if allowed, else Hit
  Rs = Surrender if allowed, else Stand
  Rp = Surrender if allowed, else Split

Tables are keyed by dealer up-card column (2-A) and player hand row.
Three sub-tables: hard totals, soft totals, pairs.
"""

from models import Rules

# Dealer up-card order used as column indices
DEALER_COLS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']

# -------------------------------------------------------------------------
# Hard totals (rows: 5..20)
# Each row: [vs 2, vs 3, vs 4, vs 5, vs 6, vs 7, vs 8, vs 9, vs 10, vs A]
# -------------------------------------------------------------------------
_HARD_H17 = {
    5:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    6:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    7:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    8:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    9:  ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    10: ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H',  'H' ],
    11: ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'D' ],
    12: ['H',  'H',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H' ],
    13: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H' ],
    14: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H' ],
    15: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'Rh', 'Rh'],
    16: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'Rh', 'Rh', 'Rh'],
    17: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'Rs'],
    18: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    19: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
}

_HARD_S17 = {
    5:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    6:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    7:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    8:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H' ],
    9:  ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    10: ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H',  'H' ],
    11: ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H' ],
    12: ['H',  'H',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H' ],
    13: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H' ],
    14: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H' ],
    15: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'Rh', 'H' ],
    16: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'Rh', 'Rh', 'Rh'],
    17: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    18: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    19: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
}

# -------------------------------------------------------------------------
# Soft totals (rows: A+2 through A+9 → soft 13..soft 20)
# -------------------------------------------------------------------------
_SOFT_H17 = {
    13: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    14: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    15: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    16: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    17: ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    18: ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S',  'S',  'H',  'H',  'H' ],
    19: ['S',  'S',  'S',  'S',  'Ds', 'S',  'S',  'S',  'S',  'S' ],
    20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
}

_SOFT_S17 = {
    13: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    14: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    15: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    16: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    17: ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H' ],
    18: ['S',  'Ds', 'Ds', 'Ds', 'Ds', 'S',  'S',  'H',  'H',  'H' ],
    19: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
}

# -------------------------------------------------------------------------
# Pairs (rows by card value: 2,2 through A,A)
# -------------------------------------------------------------------------
_PAIRS_H17 = {
    'A': ['P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P' ],
    '10':['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    '9': ['P',  'P',  'P',  'P',  'P',  'S',  'P',  'P',  'S',  'S' ],
    '8': ['P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'Rp'],
    '7': ['P',  'P',  'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H' ],
    '6': ['Ph', 'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H',  'H' ],
    '5': ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H',  'H' ],
    '4': ['H',  'H',  'H',  'Ph', 'Ph', 'H',  'H',  'H',  'H',  'H' ],
    '3': ['Ph', 'Ph', 'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H' ],
    '2': ['Ph', 'Ph', 'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H' ],
}

_PAIRS_S17 = {
    'A': ['P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P' ],
    '10':['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S' ],
    '9': ['P',  'P',  'P',  'P',  'P',  'S',  'P',  'P',  'S',  'S' ],
    '8': ['P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P' ],
    '7': ['P',  'P',  'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H' ],
    '6': ['Ph', 'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H',  'H' ],
    '5': ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H',  'H' ],
    '4': ['H',  'H',  'H',  'Ph', 'Ph', 'H',  'H',  'H',  'H',  'H' ],
    '3': ['Ph', 'Ph', 'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H' ],
    '2': ['Ph', 'Ph', 'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H' ],
}

# Row labels for display
HARD_ROWS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5]
SOFT_ROWS = [20, 19, 18, 17, 16, 15, 14, 13]
PAIR_ROWS = ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2']


def get_strategy_tables(rules):
    """Return (hard, soft, pairs) tables adjusted for the ruleset.

    Each table is a dict: row_key -> list of 10 resolved action strings.
    Composite actions are resolved based on rules (e.g., D -> H if double
    not allowed).
    """
    if rules.dealer_hits_soft_17:
        hard_raw, soft_raw, pairs_raw = _HARD_H17, _SOFT_H17, _PAIRS_H17
    else:
        hard_raw, soft_raw, pairs_raw = _HARD_S17, _SOFT_S17, _PAIRS_S17

    def resolve(action):
        if action == 'D':
            return 'D' if rules.allow_double else 'H'
        if action == 'Ds':
            return 'D' if rules.allow_double else 'S'
        if action == 'Rh':
            return 'R' if rules.allow_surrender else 'H'
        if action == 'Rs':
            return 'R' if rules.allow_surrender else 'S'
        if action == 'Rp':
            return 'R' if rules.allow_surrender else ('P' if rules.allow_split else 'H')
        if action == 'P':
            return 'P' if rules.allow_split else 'H'
        if action == 'Ph':
            if rules.allow_split and rules.allow_double_after_split:
                return 'P'
            return 'H'
        if action == 'Pd':
            if rules.allow_split and rules.allow_double_after_split:
                return 'P'
            return 'D' if rules.allow_double else 'H'
        return action  # H, S

    hard = {k: [resolve(a) for a in v] for k, v in hard_raw.items()}
    soft = {k: [resolve(a) for a in v] for k, v in soft_raw.items()}
    pairs = {k: [resolve(a) for a in v] for k, v in pairs_raw.items()}
    return hard, soft, pairs


def lookup_action(rules, player_hand, dealer_up_rank):
    """Look up the basic strategy action for a specific situation.

    Returns one of: 'H', 'S', 'D', 'P', 'R'.
    """
    hard, soft, pairs = get_strategy_tables(rules)

    # Map dealer up-card rank to column index
    if dealer_up_rank in ('j', 'q', 'k'):
        col_key = '10'
    elif dealer_up_rank == 'a':
        col_key = 'A'
    else:
        col_key = dealer_up_rank
    col_idx = DEALER_COLS.index(col_key)

    cards = player_hand.cards
    val = player_hand.value()

    # Check for pair
    if (len(cards) == 2 and rules.allow_split
            and cards[0].value() == cards[1].value()):
        pair_key = 'A' if cards[0].rank == 'a' else str(cards[0].value())
        return pairs[pair_key][col_idx]

    # Check for soft hand
    if player_hand.is_soft() and val in soft:
        return soft[val][col_idx]

    # Hard total
    if val > 20:
        return 'S'  # shouldn't happen pre-bust
    if val < 5:
        return 'H'
    return hard.get(val, ['H'] * 10)[col_idx]
