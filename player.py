from deck import Deck

class Player:
    def __init__(self):
        self.hand = []
        self.score = 0
        self.bet = 0
        self.money = 1000

    def hit(self, deck):
        card = deck.deal_card()
        self.hand.append(card)
        self.update_score()

    def update_score(self):
        self.score = self.calculate_score()

    def draw_hand(self, deck):
        for _ in range(2):
            self.hit(deck)

    def reset_hand(self):
        self.hand = []
        self.score = 0

    def calculate_score(self):
        score, aces_count = 0, 0
        for card, _ in self.hand:
            if card.isdigit():
                score += int(card)
            elif card in ['j', 'q', 'k']:
                score += 10
            elif card == 'a':
                score += 11
                aces_count += 1
        while score > 21 and aces_count > 0:
            score -= 10
            aces_count -= 1
        return score
    
class Bot(Player):
    pass