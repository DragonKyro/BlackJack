import random
import copy
from ui import UI

CARDS = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k']
SUITS = ['h', 'd', 'c', 's']
ONE_DECK = [(card, suit) for card in CARDS for suit in SUITS]
DECKS = 6

class Deck:
    def __init__(self):
        self.reset_deck()

    def reset_deck(self):
        self.deck = copy.deepcopy(ONE_DECK) * DECKS

    def deal_card(self):
        card = random.choice(self.deck)
        self.deck.remove(card)
        print(self.deck)
        return card
    
    def shuffle_deck(self):
        if len(self.deck) < 52 * DECKS * 0.25:
            self.reset_deck()
            return True
        return False