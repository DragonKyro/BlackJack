import random
import os
from dataclasses import dataclass, field


SUITS = ['c', 'd', 'h', 's']
SUIT_NAMES = {'c': 'Clubs', 'd': 'Diamonds', 'h': 'Hearts', 's': 'Spades'}
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a']
RANK_NAMES = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', '10': '10',
    'j': 'Jack', 'q': 'Queen', 'k': 'King', 'a': 'Ace'
}


@dataclass
class Rules:
    num_decks: int = 6
    penetration: float = 0.75
    dealer_hits_soft_17: bool = True
    blackjack_payout: float = 1.5       # 3:2 = 1.5, 6:5 = 1.2
    allow_double: bool = True
    allow_split: bool = True
    allow_double_after_split: bool = True
    allow_surrender: bool = False
    allow_insurance: bool = False
    min_bet: int = 10

    def blackjack_label(self):
        if self.blackjack_payout == 1.5:
            return "3:2"
        return "6:5"

    def dealer_17_label(self):
        return "H17" if self.dealer_hits_soft_17 else "S17"

    def penetration_label(self):
        return f"{int(self.penetration * 100)}%"


class Card:
    def __init__(self, rank, suit):
        self.rank = rank
        self.suit = suit

    def value(self):
        if self.rank in ('j', 'q', 'k'):
            return 10
        elif self.rank == 'a':
            return 11
        else:
            return int(self.rank)

    def count(self):
        """Hi-Lo count value."""
        v = self.value()
        if v >= 10 or self.rank == 'a':
            return -1
        elif v <= 6:
            return 1
        return 0

    def get_image_path(self):
        return os.path.join('cards', f'{self.rank}{self.suit}.png')

    def __str__(self):
        return f'{RANK_NAMES[self.rank]} of {SUIT_NAMES[self.suit]}'

    def __repr__(self):
        return f'Card({self.rank!r}, {self.suit!r})'


class Deck:
    def __init__(self, num_decks=6):
        self.num_decks = num_decks
        self.cards = []
        self.running_count = 0
        self.cards_dealt = 0
        self.shuffle()

    def shuffle(self):
        self.cards = []
        for _ in range(self.num_decks):
            for suit in SUITS:
                for rank in RANKS:
                    self.cards.append(Card(rank, suit))
        random.shuffle(self.cards)
        self.running_count = 0
        self.cards_dealt = 0

    def next_card(self):
        if not self.cards:
            self.shuffle()
        card = self.cards.pop()
        self.running_count += card.count()
        self.cards_dealt += 1
        return card

    def num_remaining(self):
        return len(self.cards)

    def true_count(self):
        decks_remaining = max(self.num_remaining() / 52, 0.5)
        return self.running_count / decks_remaining

    @staticmethod
    def get_back_image_path():
        return os.path.join('cards', 'cardback.png')


class Hand:
    def __init__(self):
        self.cards = []

    def add_card(self, card):
        self.cards.append(card)

    def value(self):
        total = sum(c.value() for c in self.cards)
        aces = sum(1 for c in self.cards if c.rank == 'a')
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        return total

    def is_blackjack(self):
        return len(self.cards) == 2 and self.value() == 21

    def is_bust(self):
        return self.value() > 21

    def is_soft(self):
        total = sum(c.value() for c in self.cards)
        aces = sum(1 for c in self.cards if c.rank == 'a')
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        return aces > 0 and total <= 21

    def can_split(self):
        if len(self.cards) != 2:
            return False
        return self.cards[0].value() == self.cards[1].value()

    def can_double(self):
        return len(self.cards) == 2

    def clear(self):
        self.cards = []

    def __str__(self):
        return ', '.join(str(c) for c in self.cards) + f' (Value: {self.value()})'


class Player:
    def __init__(self, name="Player", chips=1000, is_dealer=False):
        self.name = name
        self.chips = chips
        self.is_dealer = is_dealer
        self.hands = [Hand()]
        self.bets = [0]
        self.active_hand_index = 0
        self.done = False

    @property
    def hand(self):
        return self.hands[self.active_hand_index]

    @property
    def bet(self):
        return self.bets[self.active_hand_index]

    def place_bet(self, amount):
        amount = min(amount, self.chips)
        self.bets[0] = amount
        self.chips -= amount

    def draw_card(self, deck):
        card = deck.next_card()
        self.hand.add_card(card)
        return card

    def reset(self):
        self.hands = [Hand()]
        self.bets = [0]
        self.active_hand_index = 0
        self.done = False

    def dealer_play(self, deck, rules=None):
        """Dealer hits below 17, and on soft 17 if rules say so."""
        hits_soft_17 = rules.dealer_hits_soft_17 if rules else True
        while self.hand.value() < 17 or (
            hits_soft_17 and self.hand.value() == 17 and self.hand.is_soft()
        ):
            self.draw_card(deck)


class Round:
    def __init__(self, player, dealer, deck, rules=None):
        self.player = player
        self.dealer = dealer
        self.deck = deck
        self.rules = rules or Rules()
        self.phase = 'playing'
        self.surrendered = False
        self.results = []

    def deal_initial(self):
        self.player.draw_card(self.deck)
        self.dealer.draw_card(self.deck)
        self.player.draw_card(self.deck)
        self.dealer.draw_card(self.deck)
        self.phase = 'playing'

    def player_hit(self):
        self.player.draw_card(self.deck)
        if self.player.hand.is_bust():
            self.phase = 'result'

    def player_stand(self):
        self.phase = 'dealer_turn'

    def player_double(self):
        if not self.rules.allow_double:
            return
        additional = min(self.player.bets[0], self.player.chips)
        self.player.chips -= additional
        self.player.bets[0] += additional
        self.player.draw_card(self.deck)
        if self.player.hand.is_bust():
            self.phase = 'result'
        else:
            self.phase = 'dealer_turn'

    def player_surrender(self):
        if not self.rules.allow_surrender:
            return
        if len(self.player.hand.cards) != 2:
            return
        self.surrendered = True
        self.phase = 'result'

    def dealer_play(self):
        self.dealer.dealer_play(self.deck, self.rules)
        self.phase = 'result'

    def evaluate(self):
        player_hand = self.player.hand
        dealer_hand = self.dealer.hand
        bet = self.player.bets[0]

        player_val = player_hand.value()
        dealer_val = dealer_hand.value()
        player_bj = player_hand.is_blackjack()
        dealer_bj = dealer_hand.is_blackjack()

        if self.surrendered:
            result = 'surrender'
            payout = bet // 2
        elif player_hand.is_bust():
            result = 'bust'
            payout = 0
        elif player_bj and dealer_bj:
            result = 'push'
            payout = bet
        elif player_bj:
            result = 'blackjack'
            payout = bet + int(bet * self.rules.blackjack_payout)
        elif dealer_bj:
            result = 'lose'
            payout = 0
        elif dealer_hand.is_bust():
            result = 'win'
            payout = bet * 2
        elif player_val > dealer_val:
            result = 'win'
            payout = bet * 2
        elif player_val < dealer_val:
            result = 'lose'
            payout = 0
        else:
            result = 'push'
            payout = bet

        self.player.chips += payout
        return {
            'result': result,
            'payout': payout,
            'bet': bet,
            'player_value': player_val,
            'dealer_value': dealer_val,
        }


class Game:
    def __init__(self, rules=None):
        self.rules = rules or Rules()
        self.deck = Deck(self.rules.num_decks)
        self.player = Player("Player", chips=1000)
        self.dealer = Player("Dealer", is_dealer=True)
        self.round = None
        self.history = []

    @property
    def min_bet(self):
        return self.rules.min_bet

    def start_round(self, bet_amount):
        total_cards = self.rules.num_decks * 52
        reshuffle_threshold = total_cards * (1 - self.rules.penetration)
        if self.deck.num_remaining() < reshuffle_threshold:
            self.deck.shuffle()

        self.player.reset()
        self.dealer.reset()
        self.player.place_bet(bet_amount)
        self.round = Round(self.player, self.dealer, self.deck, self.rules)
        self.round.deal_initial()
        return self.round

    def end_round(self):
        result = self.round.evaluate()
        self.history.append(result)
        return result

    def get_stats(self):
        if not self.history:
            return {'hands_played': 0, 'wins': 0, 'losses': 0, 'pushes': 0,
                    'blackjacks': 0, 'surrenders': 0}
        wins = sum(1 for r in self.history if r['result'] in ('win', 'blackjack'))
        losses = sum(1 for r in self.history if r['result'] in ('lose', 'bust'))
        pushes = sum(1 for r in self.history if r['result'] == 'push')
        blackjacks = sum(1 for r in self.history if r['result'] == 'blackjack')
        surrenders = sum(1 for r in self.history if r['result'] == 'surrender')
        return {
            'hands_played': len(self.history),
            'wins': wins,
            'losses': losses,
            'pushes': pushes,
            'blackjacks': blackjacks,
            'surrenders': surrenders,
        }
