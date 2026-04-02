import pytest
from models import Deck, Card


class TestDeckInit:
    def test_single_deck_size(self):
        deck = Deck(num_decks=1)
        assert deck.num_remaining() == 52

    def test_six_deck_size(self):
        deck = Deck(num_decks=6)
        assert deck.num_remaining() == 312

    def test_initial_count_zero(self):
        deck = Deck(num_decks=1)
        assert deck.running_count == 0
        assert deck.cards_dealt == 0


class TestDeckDeal:
    def test_next_card_returns_card(self):
        deck = Deck(num_decks=1)
        card = deck.next_card()
        assert isinstance(card, Card)

    def test_next_card_reduces_remaining(self):
        deck = Deck(num_decks=1)
        deck.next_card()
        assert deck.num_remaining() == 51
        assert deck.cards_dealt == 1

    def test_dealing_updates_running_count(self):
        deck = Deck(num_decks=1)
        card = deck.next_card()
        assert deck.running_count == card.count()

    def test_deal_entire_deck(self):
        deck = Deck(num_decks=1)
        for _ in range(52):
            deck.next_card()
        assert deck.num_remaining() == 0
        assert deck.cards_dealt == 52

    def test_auto_reshuffle_when_empty(self):
        deck = Deck(num_decks=1)
        for _ in range(52):
            deck.next_card()
        # Should auto-reshuffle
        card = deck.next_card()
        assert isinstance(card, Card)
        assert deck.cards_dealt == 1  # Reset after reshuffle


class TestDeckShuffle:
    def test_shuffle_restores_full_deck(self):
        deck = Deck(num_decks=1)
        for _ in range(10):
            deck.next_card()
        deck.shuffle()
        assert deck.num_remaining() == 52
        assert deck.running_count == 0
        assert deck.cards_dealt == 0


class TestDeckTrueCount:
    def test_true_count_initial(self):
        deck = Deck(num_decks=6)
        assert deck.true_count() == 0.0

    def test_true_count_calculation(self):
        deck = Deck(num_decks=1)
        # Manually set running count for predictable test
        deck.running_count = 4
        # With ~52 cards remaining = 1 deck
        tc = deck.true_count()
        assert tc == pytest.approx(4.0, abs=0.5)


class TestDeckBackImage:
    def test_back_image_path(self):
        assert Deck.get_back_image_path().endswith('cardback.png')
