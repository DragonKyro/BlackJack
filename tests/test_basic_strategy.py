import pytest
from models import Rules, Hand, Card
from basic_strategy.tables import get_strategy_tables, lookup_action, DEALER_COLS, HARD_ROWS, SOFT_ROWS, PAIR_ROWS


class TestGetStrategyTables:
    def test_returns_three_tables(self):
        hard, soft, pairs = get_strategy_tables(Rules())
        assert isinstance(hard, dict)
        assert isinstance(soft, dict)
        assert isinstance(pairs, dict)

    def test_hard_table_has_all_rows(self):
        hard, _, _ = get_strategy_tables(Rules())
        for row in HARD_ROWS:
            assert row in hard
            assert len(hard[row]) == len(DEALER_COLS)

    def test_soft_table_has_all_rows(self):
        _, soft, _ = get_strategy_tables(Rules())
        for row in SOFT_ROWS:
            assert row in soft
            assert len(soft[row]) == len(DEALER_COLS)

    def test_pairs_table_has_all_rows(self):
        _, _, pairs = get_strategy_tables(Rules())
        for row in PAIR_ROWS:
            assert row in pairs
            assert len(pairs[row]) == len(DEALER_COLS)

    def test_all_actions_are_resolved(self):
        """No composite actions (Ds, Rh, Ph, etc.) should remain after resolution."""
        hard, soft, pairs = get_strategy_tables(Rules())
        valid = {'H', 'S', 'D', 'P', 'R'}
        for table in (hard, soft, pairs):
            for row, actions in table.items():
                for a in actions:
                    assert a in valid, f"Unresolved action {a!r} in row {row}"


class TestResolveRules:
    def test_no_double_resolves_D_to_H(self):
        rules = Rules(allow_double=False)
        hard, _, _ = get_strategy_tables(rules)
        # Hard 11 vs 2 is normally D, should become H
        assert hard[11][0] == 'H'

    def test_no_surrender_resolves_Rh_to_H(self):
        rules = Rules(allow_surrender=False)
        hard, _, _ = get_strategy_tables(rules)
        # Hard 16 vs 10 is normally Rh, should become H
        col_10 = DEALER_COLS.index('10')
        assert hard[16][col_10] == 'H'

    def test_surrender_allowed_resolves_Rh_to_R(self):
        rules = Rules(allow_surrender=True)
        hard, _, _ = get_strategy_tables(rules)
        col_10 = DEALER_COLS.index('10')
        assert hard[16][col_10] == 'R'

    def test_no_split_resolves_P_to_H(self):
        rules = Rules(allow_split=False)
        _, _, pairs = get_strategy_tables(rules)
        # Aces vs 2 is normally P, should become H
        assert pairs['A'][0] == 'H'

    def test_no_das_resolves_Ph_to_H(self):
        rules = Rules(allow_double_after_split=False)
        _, _, pairs = get_strategy_tables(rules)
        # 6,6 vs 2 is normally Ph, should become H
        assert pairs['6'][0] == 'H'

    def test_h17_vs_s17_differ(self):
        h17 = get_strategy_tables(Rules(dealer_hits_soft_17=True))
        s17 = get_strategy_tables(Rules(dealer_hits_soft_17=False))
        # At least one cell should differ between the two
        any_diff = False
        for table_idx in range(3):
            for key in h17[table_idx]:
                if h17[table_idx][key] != s17[table_idx][key]:
                    any_diff = True
                    break
        assert any_diff


def _make_hand(*ranks):
    h = Hand()
    for r in ranks:
        h.add_card(Card(r, 'h'))
    return h


class TestLookupAction:
    def test_hard_16_vs_10_with_surrender(self):
        rules = Rules(allow_surrender=True)
        hand = _make_hand('10', '6')
        assert lookup_action(rules, hand, '10') == 'R'

    def test_hard_16_vs_10_no_surrender(self):
        rules = Rules(allow_surrender=False)
        hand = _make_hand('10', '6')
        assert lookup_action(rules, hand, '10') == 'H'

    def test_soft_18_vs_2(self):
        rules = Rules()
        hand = _make_hand('a', '7')
        action = lookup_action(rules, hand, '2')
        assert action in ('S', 'D')  # Ds resolved

    def test_pair_of_8s_vs_6(self):
        rules = Rules()
        hand = _make_hand('8', '8')
        assert lookup_action(rules, hand, '6') == 'P'

    def test_pair_of_8s_no_split(self):
        rules = Rules(allow_split=False)
        hand = _make_hand('8', '8')
        # Should fall through to hard 16
        assert lookup_action(rules, hand, '6') == 'S'

    def test_face_card_maps_to_10(self):
        rules = Rules()
        hand = _make_hand('10', '6')
        # j, q, k should all map to 10
        for rank in ('j', 'q', 'k', '10'):
            action = lookup_action(rules, hand, rank)
            assert action == lookup_action(rules, hand, '10')

    def test_dealer_ace(self):
        rules = Rules()
        hand = _make_hand('10', '6')
        action = lookup_action(rules, hand, 'a')
        assert action in ('H', 'R')  # Hit or surrender depending

    def test_blackjack_hand(self):
        rules = Rules()
        hand = _make_hand('a', 'k')
        # Blackjack — value 21, soft, should Stand
        assert lookup_action(rules, hand, '5') == 'S'

    def test_hard_11_vs_6(self):
        rules = Rules()
        hand = _make_hand('6', '5')
        assert lookup_action(rules, hand, '6') == 'D'
