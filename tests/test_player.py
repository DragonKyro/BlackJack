import pytest
from models import Player, Deck


class TestPlayerInit:
    def test_default_player(self):
        p = Player()
        assert p.name == "Player"
        assert p.chips == 1000
        assert not p.is_dealer
        assert len(p.hands) == 1
        assert len(p.hands[0].cards) == 0

    def test_dealer(self):
        d = Player("Dealer", is_dealer=True)
        assert d.is_dealer


class TestPlayerBetting:
    def test_place_bet(self):
        p = Player(chips=500)
        p.place_bet(100)
        assert p.bets[0] == 100
        assert p.chips == 400

    def test_bet_capped_at_chips(self):
        p = Player(chips=50)
        p.place_bet(100)
        assert p.bets[0] == 50
        assert p.chips == 0


class TestPlayerDrawCard:
    def test_draw_card(self):
        p = Player()
        deck = Deck(num_decks=1)
        card = p.draw_card(deck)
        assert len(p.hand.cards) == 1
        assert p.hand.cards[0] is card


class TestPlayerReset:
    def test_reset_clears_hand(self):
        p = Player(chips=500)
        deck = Deck(num_decks=1)
        p.place_bet(100)
        p.draw_card(deck)
        p.draw_card(deck)
        p.reset()
        assert len(p.hands) == 1
        assert len(p.hand.cards) == 0
        assert p.bets == [0]
        assert p.chips == 400  # Chips don't reset


class TestDealerPlay:
    def test_dealer_hits_below_17(self):
        d = Player("Dealer", is_dealer=True)
        deck = Deck(num_decks=6)
        # Give dealer a low hand
        from models import Card, Hand
        d.hands[0].add_card(Card('3', 'h'))
        d.hands[0].add_card(Card('4', 'd'))
        d.dealer_play(deck)
        assert d.hand.value() >= 17

    def test_dealer_stands_on_hard_17(self):
        d = Player("Dealer", is_dealer=True)
        deck = Deck(num_decks=6)
        from models import Card
        d.hands[0].add_card(Card('10', 'h'))
        d.hands[0].add_card(Card('7', 'd'))
        d.dealer_play(deck)
        assert d.hand.value() == 17  # Should not hit

    def test_dealer_hits_soft_17(self):
        d = Player("Dealer", is_dealer=True)
        deck = Deck(num_decks=6)
        from models import Card
        d.hands[0].add_card(Card('a', 'h'))
        d.hands[0].add_card(Card('6', 'd'))
        assert d.hand.is_soft()
        d.dealer_play(deck)
        # Dealer must hit soft 17, so value should change
        assert d.hand.value() != 17 or len(d.hand.cards) > 2
