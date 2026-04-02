import pytest
from models import Card, Hand


def make_hand(*cards):
    """Helper to build a hand from (rank, suit) tuples."""
    h = Hand()
    for rank, suit in cards:
        h.add_card(Card(rank, suit))
    return h


class TestHandValue:
    def test_simple_hand(self):
        h = make_hand(('5', 'h'), ('3', 'd'))
        assert h.value() == 8

    def test_face_cards(self):
        h = make_hand(('k', 's'), ('q', 'h'))
        assert h.value() == 20

    def test_ace_as_eleven(self):
        h = make_hand(('a', 'c'), ('7', 'd'))
        assert h.value() == 18

    def test_ace_reduced_to_one(self):
        h = make_hand(('a', 'c'), ('7', 'd'), ('8', 's'))
        assert h.value() == 16  # 11+7+8=26 -> 1+7+8=16

    def test_two_aces(self):
        h = make_hand(('a', 'c'), ('a', 'd'))
        assert h.value() == 12  # 11+1=12

    def test_three_aces(self):
        h = make_hand(('a', 'c'), ('a', 'd'), ('a', 'h'))
        assert h.value() == 13  # 11+1+1=13

    def test_blackjack_value(self):
        h = make_hand(('a', 's'), ('k', 'h'))
        assert h.value() == 21


class TestHandBlackjack:
    def test_ace_king_is_blackjack(self):
        h = make_hand(('a', 's'), ('k', 'h'))
        assert h.is_blackjack()

    def test_ace_ten_is_blackjack(self):
        h = make_hand(('a', 'c'), ('10', 'd'))
        assert h.is_blackjack()

    def test_three_card_21_not_blackjack(self):
        h = make_hand(('7', 'h'), ('7', 'd'), ('7', 's'))
        assert h.value() == 21
        assert not h.is_blackjack()

    def test_two_card_not_21_not_blackjack(self):
        h = make_hand(('10', 's'), ('9', 'h'))
        assert not h.is_blackjack()


class TestHandBust:
    def test_not_bust(self):
        h = make_hand(('10', 'h'), ('k', 'd'))
        assert not h.is_bust()

    def test_bust(self):
        h = make_hand(('10', 'h'), ('8', 'd'), ('5', 's'))
        assert h.is_bust()

    def test_21_not_bust(self):
        h = make_hand(('10', 'h'), ('5', 'd'), ('6', 's'))
        assert not h.is_bust()


class TestHandSoft:
    def test_soft_hand(self):
        h = make_hand(('a', 'c'), ('6', 'd'))
        assert h.is_soft()  # Soft 17

    def test_hard_hand(self):
        h = make_hand(('10', 'h'), ('7', 'd'))
        assert not h.is_soft()

    def test_ace_forced_to_one_is_hard(self):
        h = make_hand(('a', 'c'), ('7', 'd'), ('8', 's'))
        assert not h.is_soft()  # 1+7+8=16, ace forced to 1


class TestHandCanSplit:
    def test_pair_can_split(self):
        h = make_hand(('8', 'h'), ('8', 'd'))
        assert h.can_split()

    def test_face_pair_can_split(self):
        h = make_hand(('k', 'h'), ('q', 'd'))
        assert h.can_split()  # Both value 10

    def test_non_pair_cannot_split(self):
        h = make_hand(('8', 'h'), ('9', 'd'))
        assert not h.can_split()

    def test_three_cards_cannot_split(self):
        h = make_hand(('8', 'h'), ('8', 'd'), ('8', 's'))
        assert not h.can_split()


class TestHandCanDouble:
    def test_two_cards_can_double(self):
        h = make_hand(('5', 'h'), ('6', 'd'))
        assert h.can_double()

    def test_three_cards_cannot_double(self):
        h = make_hand(('5', 'h'), ('3', 'd'), ('2', 's'))
        assert not h.can_double()


class TestHandClear:
    def test_clear(self):
        h = make_hand(('5', 'h'), ('3', 'd'))
        h.clear()
        assert len(h.cards) == 0
        assert h.value() == 0
