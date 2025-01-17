import pygame
from deck import Deck
from player import Player, Dealer
from ui import UI
from scoreboard import Scoreboard

class Game:
    def __init__(self):
        # Initialization
        pygame.init()
        self.WIDTH, self.HEIGHT = 1280, 720
        self.screen = pygame.display.set_mode((self.WIDTH, self.HEIGHT), pygame.RESIZABLE)
        pygame.display.set_caption('Blackjack')
        self.FPS = 60
        self.clock = pygame.time.Clock()
        self.ui = UI(self.WIDTH, self.HEIGHT)
        self.running = True

        # Title Screen
        self.draw_settings = False


        # Game
        self.deck = Deck()
        self.player = Player()
        self.dealer = Dealer()
        self.scoreboard = Scoreboard()
        self.active_game = False
        self.initial_deal = False
        self.reveal_dealer = False
        self.hand_active = False
        self.outcome = 0
        self.add_score = False
        self.bet_amounts = ['1', '5', '25', '100', '500']
        self.shuffle_percentage = 0.75
        self.title_screen()

    def title_screen(self):
        """Display title screen with game instructions."""
        while self.running:
            self.clock.tick(self.FPS)
            self.screen.fill('darkgreen')
            self.ui.create_fonts(self.HEIGHT)
            start_button, settings_button = self.ui.draw_title_screen(self.WIDTH, self.HEIGHT)

            if self.draw_settings:
                self.ui.draw_settings(self.WIDTH, self.HEIGHT)
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.VIDEORESIZE:
                    self.WIDTH, self.HEIGHT = event.w, event.h
                    self.screen = pygame.display.set_mode((self.WIDTH, self.HEIGHT), pygame.RESIZABLE)
                elif event.type == pygame.MOUSEBUTTONUP:
                    if start_button.collidepoint(event.pos):
                        self.run_game()
                    elif settings_button.collidepoint(event.pos):
                        self.draw_settings = True
            pygame.display.flip()

    def run_game(self):
        """Main game loop."""
        while self.running:
            self.clock.tick(self.FPS)
            self.ui.create_fonts(self.HEIGHT)
            self.screen.fill('darkgreen')
            
            # Deal initial cards if required
            if self.initial_deal:
                self.player.draw_hand(self.deck)
                self.dealer.draw_hand(self.deck)
                self.initial_deal = False

            # Update scores and display hands if the game is active
            if self.active_game:
                self.player.update_score()
                self.ui.draw_cards(self.player.hand, self.dealer.hand, self.reveal_dealer, self.WIDTH, self.HEIGHT)
                
                if self.reveal_dealer:
                    self.dealer.update_score()
                    if self.dealer.score < 17:
                        self.dealer.hit(self.deck)
                
                self.ui.draw_scores(self.player.score, self.dealer.score, self.reveal_dealer, self.WIDTH, self.HEIGHT)

            self.ui.draw_amounts(self.active_game, self.player.bet, self.player.money, self.WIDTH, self.HEIGHT)

            # Draw buttons and get their states
            buttons = self.ui.draw_game_buttons(
                self.active_game, self.scoreboard.records, self.outcome, self.bet_amounts,
                dim=self.outcome, WIDTH=self.WIDTH, HEIGHT=self.HEIGHT
            )

            # Handle events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.VIDEORESIZE:
                    self.WIDTH, self.HEIGHT = event.w, event.h
                    self.screen = pygame.display.set_mode((self.WIDTH, self.HEIGHT), pygame.RESIZABLE)
                elif event.type == pygame.MOUSEBUTTONUP:
                    self.handle_mouse_click(event, buttons)

            # Auto-end hand if player's score is >= 21
            if self.hand_active and self.player.score >= 21:
                self.hand_active = False
                self.reveal_dealer = True

            # Check for game outcome and update records
            self.outcome, self.scoreboard.records, self.add_score, self.player.money, self.player.bet = self.scoreboard.check_game_end(
                self.hand_active, self.dealer.score, self.player.score, self.outcome, self.add_score, self.player.money, self.player.bet
            )

            pygame.display.flip()

    def handle_mouse_click(self, event, buttons):
        """
        Handle mouse click events, mapping button actions to game logic.
        """
        # Extract main buttons and bet buttons
        main_buttons = buttons[:-1]
        bet_buttons = buttons[-1] 

        # Game not active: Handle 'Deal' button and bet adjustments
        if not self.active_game:
            if main_buttons[0].collidepoint(event.pos):  # Deal button
                self.active_game = True
                self.initial_deal = True
                self.player.reset_hand()
                self.dealer.reset_hand()
                self.outcome, self.hand_active, self.reveal_dealer = 0, True, False
                self.add_score = True
                if self.deck.shuffle_deck():
                    self.ui.shuffle(self.WIDTH, self.HEIGHT)

            for i, (subtract_button, add_button) in enumerate(bet_buttons):  # Bet buttons
                bet_amount = int(self.bet_amounts[i])
                if subtract_button.collidepoint(event.pos) and self.player.bet - bet_amount >= 0:
                    self.player.bet -= bet_amount
                    self.player.money += bet_amount
                elif add_button.collidepoint(event.pos) and self.player.money - bet_amount >= 0:
                    self.player.bet += bet_amount
                    self.player.money -= bet_amount

        # Game active: Handle 'Hit', 'Stand', and 'New Hand' buttons
        else:
            if main_buttons[0].collidepoint(event.pos) and self.player.score < 21 and self.hand_active:  # Hit button
                self.player.hit(self.deck)
            elif main_buttons[1].collidepoint(event.pos) and not self.reveal_dealer:  # Stand button
                self.reveal_dealer = True
                self.hand_active = False
            elif len(main_buttons) > 2 and main_buttons[2].collidepoint(event.pos):  # New Hand button
                self.active_game = False
                self.player.reset_hand()
                self.dealer.reset_hand()
                self.outcome, self.hand_active, self.reveal_dealer = 0, False, False
                self.add_score, self.dealer.score, self.player.score = False, 0, 0


if __name__ == '__main__':
    Game()
    pygame.quit()