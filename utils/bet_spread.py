"""
Bet spread analysis engine.

Calculates expected value, standard deviation, risk of ruin, and
hourly projections for a given bet spread, ruleset, and bankroll.

Uses the well-known Hi-Lo true count frequency distribution and
per-count player edge approximations.
"""

import math
from dataclasses import dataclass, field
from models import Rules


# -------------------------------------------------------------------------
# True count frequency distribution (6-deck, ~75% penetration)
# Source: standard Hi-Lo simulation data.
# Keys are integer true counts, values are approximate % of hands played
# at that count. Covers TC -7 to +7 (accounts for ~99% of hands).
# -------------------------------------------------------------------------
TC_FREQ_6D = {
    -7: 0.5,  -6: 1.0,  -5: 2.0,  -4: 3.5,  -3: 5.5,
    -2: 8.5,  -1: 12.5,  0: 25.0,
     1: 15.0,  2: 10.0,  3: 6.5,   4: 4.0,   5: 2.5,
     6: 1.5,   7: 1.0,   8: 0.5,   9: 0.3,  10: 0.2,
}

# Adjusted frequencies by deck count (rough scaling)
# Fewer decks → wider TC swings → more time at extreme counts
TC_FREQ_BY_DECKS = {
    1: {
        -7: 1.5, -6: 2.0, -5: 3.0, -4: 4.5, -3: 6.0,
        -2: 8.0, -1: 11.0, 0: 18.0,
         1: 13.0, 2: 9.5,  3: 7.0,  4: 5.5,  5: 4.0,
         6: 3.0,  7: 2.0,  8: 1.0,  9: 0.5, 10: 0.5,
    },
    2: {
        -7: 1.0, -6: 1.5, -5: 2.5, -4: 4.0, -3: 5.5,
        -2: 8.0, -1: 12.0, 0: 22.0,
         1: 14.0, 2: 10.0, 3: 7.0,  4: 4.5,  5: 3.5,
         6: 2.0,  7: 1.5,  8: 0.5,  9: 0.3, 10: 0.2,
    },
}


def _get_tc_freq(num_decks):
    """Return TC frequency dict for given deck count."""
    if num_decks in TC_FREQ_BY_DECKS:
        return TC_FREQ_BY_DECKS[num_decks]
    return TC_FREQ_6D  # default for 4, 6, 8


# -------------------------------------------------------------------------
# House edge and per-TC player advantage
# -------------------------------------------------------------------------

def base_house_edge(rules):
    """Approximate base house edge (%) for the given ruleset at TC 0.

    Uses additive rule adjustments from standard references.
    """
    # Start with baseline for 6-deck, S17, 3:2, no DAS, no surrender
    edge = -0.40  # ~0.40% house edge baseline

    # Deck adjustment
    deck_adj = {1: 0.48, 2: 0.19, 4: 0.06, 6: 0.0, 8: -0.02}
    edge += deck_adj.get(rules.num_decks, 0.0)

    # H17 costs player ~0.22%
    if rules.dealer_hits_soft_17:
        edge -= 0.22

    # 6:5 BJ costs ~1.39%
    if rules.blackjack_payout < 1.5:
        edge -= 1.39

    # DAS worth ~0.14%
    if rules.allow_double_after_split:
        edge += 0.14

    # Late surrender worth ~0.08%
    if rules.allow_surrender:
        edge += 0.08

    # No double costs ~1.48% (but we always allow by default)
    if not rules.allow_double:
        edge -= 1.48

    # No split costs ~0.57%
    if not rules.allow_split:
        edge -= 0.57

    return edge


# Player edge change per true count (Hi-Lo)
# Approximately +0.50% per true count above 0
EDGE_PER_TC = 0.50


def player_edge_at_tc(rules, tc):
    """Return player edge (%) at a given true count."""
    return base_house_edge(rules) + tc * EDGE_PER_TC


# -------------------------------------------------------------------------
# Bet spread analysis
# -------------------------------------------------------------------------

@dataclass
class BetSpread:
    """Maps true count to bet size (in units)."""
    spread: dict = field(default_factory=lambda: {
        # TC: units bet (0 = sit out)
        -7: 0, -6: 0, -5: 0, -4: 0, -3: 0, -2: 1, -1: 1, 0: 1,
        1: 1, 2: 2, 3: 4, 4: 8, 5: 12, 6: 12, 7: 12, 8: 12, 9: 12, 10: 12,
    })

    def get_bet(self, tc):
        if tc in self.spread:
            return self.spread[tc]
        if tc < min(self.spread):
            return self.spread[min(self.spread)]
        return self.spread[max(self.spread)]


@dataclass
class BetSpreadResults:
    """Results from bet spread analysis."""
    base_edge_pct: float = 0.0
    avg_bet_units: float = 0.0
    ev_per_hand_units: float = 0.0
    ev_per_hour_units: float = 0.0
    ev_per_hour_dollars: float = 0.0
    sd_per_hand_units: float = 0.0
    sd_per_hour_units: float = 0.0
    sd_per_hour_dollars: float = 0.0
    risk_of_ruin_pct: float = 0.0
    n50_hours: float = 0.0    # hours to have 50% chance of reaching goal
    hands_per_hour: int = 80
    unit_size: float = 10.0
    bankroll_units: float = 0.0
    tc_details: list = field(default_factory=list)


def analyze_bet_spread(rules, spread, unit_size=10.0, bankroll=10000.0,
                       hands_per_hour=80):
    """Run full bet spread analysis.

    Returns a BetSpreadResults with all computed metrics.
    """
    tc_freq = _get_tc_freq(rules.num_decks)
    bankroll_units = bankroll / unit_size

    total_freq = sum(tc_freq.values())

    # Compute weighted EV and variance
    weighted_ev = 0.0
    weighted_var = 0.0
    weighted_bet = 0.0
    hands_played_pct = 0.0
    tc_details = []

    # Standard deviation per hand in blackjack is ~1.15 * bet
    SD_FACTOR = 1.15

    for tc, freq_pct in sorted(tc_freq.items()):
        freq = freq_pct / total_freq
        bet_units = spread.get_bet(tc)
        edge = player_edge_at_tc(rules, tc) / 100.0

        ev_hand = bet_units * edge
        var_hand = (bet_units * SD_FACTOR) ** 2

        weighted_ev += freq * ev_hand
        weighted_var += freq * var_hand
        weighted_bet += freq * bet_units

        if bet_units > 0:
            hands_played_pct += freq_pct

        tc_details.append({
            'tc': tc,
            'freq_pct': freq_pct,
            'bet_units': bet_units,
            'edge_pct': edge * 100,
            'ev_per_hand': ev_hand,
        })

    sd_per_hand = math.sqrt(weighted_var) if weighted_var > 0 else 0

    ev_per_hour = weighted_ev * hands_per_hour
    sd_per_hour = sd_per_hand * math.sqrt(hands_per_hour)

    # Risk of ruin formula: RoR = e^(-2 * EV * bankroll / variance)
    # Only meaningful when EV > 0
    if weighted_ev > 0 and sd_per_hand > 0:
        ror = math.exp(-2 * weighted_ev * bankroll_units / (sd_per_hand ** 2))
        ror = min(ror, 1.0)
    elif weighted_ev <= 0:
        ror = 1.0
    else:
        ror = 0.0

    # Hours to have 50% chance of being ahead by 1 standard deviation
    # Solve: EV*n = SD*sqrt(n) → n = (SD/EV)^2 hands → /hands_per_hour
    if ev_per_hour > 0:
        n50_hands = (sd_per_hand / weighted_ev) ** 2 if weighted_ev > 0 else float('inf')
        n50_hours = n50_hands / hands_per_hour
    else:
        n50_hours = float('inf')

    results = BetSpreadResults(
        base_edge_pct=base_house_edge(rules),
        avg_bet_units=weighted_bet,
        ev_per_hand_units=weighted_ev,
        ev_per_hour_units=ev_per_hour,
        ev_per_hour_dollars=ev_per_hour * unit_size,
        sd_per_hand_units=sd_per_hand,
        sd_per_hour_units=sd_per_hour,
        sd_per_hour_dollars=sd_per_hour * unit_size,
        risk_of_ruin_pct=ror * 100,
        n50_hours=n50_hours,
        hands_per_hour=hands_per_hour,
        unit_size=unit_size,
        bankroll_units=bankroll_units,
        tc_details=tc_details,
    )
    return results
