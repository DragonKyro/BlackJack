import pytest
from models import Rules


class TestRulesDefaults:
    def test_defaults(self):
        r = Rules()
        assert r.num_decks == 6
        assert r.penetration == 0.75
        assert r.dealer_hits_soft_17 is True
        assert r.blackjack_payout == 1.5
        assert r.allow_double is True
        assert r.allow_split is True
        assert r.allow_double_after_split is True
        assert r.allow_surrender is False
        assert r.allow_insurance is False
        assert r.min_bet == 10


class TestRulesCustom:
    def test_custom_values(self):
        r = Rules(num_decks=2, penetration=0.80, dealer_hits_soft_17=False,
                  blackjack_payout=1.2, allow_surrender=True, min_bet=25)
        assert r.num_decks == 2
        assert r.penetration == 0.80
        assert r.dealer_hits_soft_17 is False
        assert r.blackjack_payout == 1.2
        assert r.allow_surrender is True
        assert r.min_bet == 25


class TestRulesLabels:
    def test_blackjack_label_3_2(self):
        assert Rules(blackjack_payout=1.5).blackjack_label() == "3:2"

    def test_blackjack_label_6_5(self):
        assert Rules(blackjack_payout=1.2).blackjack_label() == "6:5"

    def test_dealer_17_h17(self):
        assert Rules(dealer_hits_soft_17=True).dealer_17_label() == "H17"

    def test_dealer_17_s17(self):
        assert Rules(dealer_hits_soft_17=False).dealer_17_label() == "S17"

    def test_penetration_label(self):
        assert Rules(penetration=0.75).penetration_label() == "75%"
        assert Rules(penetration=0.50).penetration_label() == "50%"
