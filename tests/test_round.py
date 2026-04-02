import pytest
from models import Card, Hand, Player, Deck, Round


def setup_round(player_cards, dealer_cards, bet=100, num_decks=6):
    """Helper to create a round with specific hands for deterministic testing."""
    player = Player("Player", chips=1000)
    dealer = Player("Dealer", is_dealer=True)
    deck = Deck(num_decks=num_decks)

    player.place_bet(bet)

    for rank, suit in player_cards:
        player.hands[0].add_card(Card(rank, suit))
    for rank, suit in dealer_cards:
        dealer.hands[0].add_card(Card(rank, suit))

    rnd = Round(player, dealer, deck)
    rnd.phase = 'playing'
    return rnd, player, dealer


class TestRoundDealInitial:
    def test_deal_gives_two_cards_each(self):
        player = Player("Player", chips=1000)
        dealer = Player("Dealer", is_dealer=True)
        deck = Deck(num_decks=6)
        player.place_bet(100)
        rnd = Round(player, dealer, deck)
        rnd.deal_initial()
        assert len(player.hand.cards) == 2
        assert len(dealer.hand.cards) == 2

    def test_deal_alternates_cards(self):
        """Cards should be dealt player-dealer-player-dealer."""
        player = Player("Player", chips=1000)
        dealer = Player("Dealer", is_dealer=True)
        deck = Deck(num_decks=6)
        player.place_bet(50)
        initial_count = deck.num_remaining()
        rnd = Round(player, dealer, deck)
        rnd.deal_initial()
        assert deck.num_remaining() == initial_count - 4


class TestRoundPlayerHit:
    def test_hit_adds_card(self):
        rnd, player, _ = setup_round(
            [('5', 'h'), ('6', 'd')],
            [('10', 's'), ('7', 'c')],
        )
        rnd.player_hit()
        assert len(player.hand.cards) == 3

    def test_hit_bust_ends_round(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('6', 'd'), ('5', 's')],  # 21
            [('10', 's'), ('7', 'c')],
        )
        # Add a card that will bust
        player.hands[0].add_card(Card('2', 'c'))  # 23
        assert player.hand.is_bust()


class TestRoundPlayerStand:
    def test_stand_moves_to_dealer_turn(self):
        rnd, _, _ = setup_round(
            [('10', 'h'), ('8', 'd')],
            [('10', 's'), ('7', 'c')],
        )
        rnd.player_stand()
        assert rnd.phase == 'dealer_turn'


class TestRoundPlayerDouble:
    def test_double_adds_to_bet(self):
        rnd, player, _ = setup_round(
            [('5', 'h'), ('6', 'd')],
            [('10', 's'), ('7', 'c')],
            bet=100,
        )
        rnd.player_double()
        assert player.bets[0] == 200
        assert len(player.hand.cards) == 3

    def test_double_deducts_chips(self):
        rnd, player, _ = setup_round(
            [('5', 'h'), ('6', 'd')],
            [('10', 's'), ('7', 'c')],
            bet=100,
        )
        chips_before = player.chips
        rnd.player_double()
        assert player.chips == chips_before - 100


class TestRoundEvaluate:
    def test_player_wins(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('9', 'd')],  # 19
            [('10', 's'), ('7', 'c')],  # 17
            bet=100,
        )
        rnd.dealer_play()
        result = rnd.evaluate()
        assert result['result'] == 'win'
        assert result['payout'] == 200

    def test_dealer_wins(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('6', 'd')],  # 16
            [('10', 's'), ('8', 'c')],  # 18
            bet=100,
        )
        rnd.dealer_play()
        result = rnd.evaluate()
        assert result['result'] == 'lose'
        assert result['payout'] == 0

    def test_push(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('8', 'd')],  # 18
            [('10', 's'), ('8', 'c')],  # 18
            bet=100,
        )
        rnd.dealer_play()
        result = rnd.evaluate()
        assert result['result'] == 'push'
        assert result['payout'] == 100

    def test_player_blackjack(self):
        rnd, player, _ = setup_round(
            [('a', 'h'), ('k', 'd')],  # BJ
            [('10', 's'), ('8', 'c')],  # 18
            bet=100,
        )
        rnd.dealer_play()
        result = rnd.evaluate()
        assert result['result'] == 'blackjack'
        assert result['payout'] == 250  # 100 + 150

    def test_both_blackjack_is_push(self):
        rnd, player, _ = setup_round(
            [('a', 'h'), ('k', 'd')],  # BJ
            [('a', 's'), ('q', 'c')],  # BJ
            bet=100,
        )
        result = rnd.evaluate()
        assert result['result'] == 'push'
        assert result['payout'] == 100

    def test_player_bust(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('8', 'd'), ('5', 's')],  # 23 bust
            [('10', 's'), ('7', 'c')],
            bet=100,
        )
        result = rnd.evaluate()
        assert result['result'] == 'bust'
        assert result['payout'] == 0

    def test_dealer_bust_player_wins(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('8', 'd')],  # 18
            [('10', 's'), ('6', 'c')],  # 16 - dealer will bust or hit
            bet=100,
        )
        # Manually bust the dealer
        rnd.dealer.hands[0].add_card(Card('10', 'd'))  # 26
        result = rnd.evaluate()
        assert result['result'] == 'win'
        assert result['payout'] == 200

    def test_payout_updates_chips(self):
        rnd, player, _ = setup_round(
            [('10', 'h'), ('9', 'd')],  # 19
            [('10', 's'), ('7', 'c')],  # 17
            bet=100,
        )
        chips_before = player.chips
        rnd.dealer_play()
        result = rnd.evaluate()
        assert player.chips == chips_before + 200
