class Scoreboard:
    def __init__(self):
        self.records = [0, 0, 0]  # wins, losses, ties

    def check_game_end(self, hand_active, dealer_score, player_score, outcome, add_score, money, bet):
        if not hand_active and dealer_score >= 17:
            if player_score > 21:
                outcome = 1
            elif dealer_score < player_score <= 21 or dealer_score > 21:
                outcome = 2
            elif player_score < dealer_score <= 21:
                outcome = 3
            else:
                outcome = 4

            if add_score:
                if outcome in [1, 3]:
                    self.records[1] += 1
                elif outcome == 2:
                    self.records[0] += 1
                    money += bet * 2
                else:
                    self.records[2] += 1
                    money += bet
                add_score = False
                bet = 0

        return outcome, self.records, add_score, money, bet