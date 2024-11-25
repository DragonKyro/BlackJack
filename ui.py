import pygame

class UI:
    def __init__(self, width, height):
        self.WIDTH = width
        self.HEIGHT = height
        self.FONT = None
        self.SMALL_FONT = None
        self.BIG_FONT = None
        self.results_text = ['', 'Player Busted o_0', 'Player WINS! :D', 'Dealer WINS! :(', 'Tie... :|']

    def create_fonts(self, height):
        '''Create scalable fonts based on the current screen size'''
        self.FONT = pygame.font.Font("Namaku.ttf", int(height * 0.06))  # 7% of screen height
        self.SMALL_FONT = pygame.font.Font("Namaku.ttf", int(height * 0.04))  # 4% of screen height
        self.BIG_FONT = pygame.font.Font("Namaku.ttf", int(height * 0.1))  # 10% of screen height

    def draw_scores(self, player_score, dealer_score, reveal_dealer):
        '''Draw player and dealer scores on the screen'''

        # Render player score
        player_obj = self.FONT.render(f'Player Score: {player_score}', True, 'white')
        player_rect = player_obj.get_rect(center=(self.WIDTH / 2, self.HEIGHT * 0.8))
        pygame.display.get_surface().blit(player_obj, player_rect)

        # Render dealer score only if revealed
        if reveal_dealer:
            dealer_obj = self.FONT.render(f'Dealer Score: {dealer_score}', True, 'white')
            dealer_rect = dealer_obj.get_rect(center=(self.WIDTH / 2, self.HEIGHT * 0.15))
            pygame.display.get_surface().blit(dealer_obj, dealer_rect)

    def draw_cards(self, player_hand, dealer_hand, reveal_dealer):
        '''Display player and dealer cards on the screen'''
        
        # Calculate card width relative to the screen size and maintain a 5:7 aspect ratio
        card_width = self.WIDTH * 0.1  # Adjust the multiplier to control card size relative to screen width
        card_height = card_width * (7 / 5)  # Maintain 5:7 width-height ratio

        # Set the card gap relative to card width for consistent spacing
        card_gap = card_width * -0.5

        # Calculate starting positions for centering the cards horizontally
        player_total_width = len(player_hand) * card_width + (len(player_hand) - 1) * card_gap
        dealer_total_width = len(dealer_hand) * card_width + (len(dealer_hand) - 1) * card_gap

        player_start_x = (self.WIDTH - player_total_width) / 2
        dealer_start_x = (self.WIDTH - dealer_total_width) / 2

        # Y-positions for the player and dealer hands, relative to screen height
        player_y = self.HEIGHT * 0.5
        dealer_y = self.HEIGHT * 0.2

        screen = pygame.display.get_surface()

        # Draw player cards
        for i, card in enumerate(player_hand):
            card_image = pygame.image.load(f'img/{card[0]}{card[1]}.png')
            card_image = pygame.transform.scale(card_image, (int(card_width), int(card_height)))
            screen.blit(card_image, (player_start_x + i * (card_width + card_gap), player_y))
 
        # Draw dealer cards
        for i, card in enumerate(dealer_hand):
            if i != 0 or reveal_dealer:
                card_image = pygame.image.load(f'img/{card[0]}{card[1]}.png')
            else:
                card_image = pygame.image.load('img/back.png')  # Hide the first card if not revealed
            card_image = pygame.transform.scale(card_image, (int(card_width), int(card_height)))
            screen.blit(card_image, (dealer_start_x + i * (card_width + card_gap), dealer_y))

    def draw_game_buttons(self, active_game, records, outcome, bet_amounts, dim):
        '''Draw game buttons (Deal, Hit, Stand, Continue) and display game status'''
        
        screen = pygame.display.get_surface()
        buttons = []
        bet_buttons = []

        # Calculate relative positions and sizes based on screen dimensions
        deal_width, deal_height = self.WIDTH * 0.2, self.HEIGHT * 0.1
        button_width, button_height = self.WIDTH * 0.15, self.HEIGHT * 0.1
        margin = self.HEIGHT * 0.05
        bet_button_size = self.WIDTH * 0.04
        bet_button_margin = self.WIDTH * 0.02
        chip_size = self.WIDTH * 0.14

        # Dim the screen if needed
        if dim:
            self.dim_screen()

        # If game not active, draw the "Deal" button
        if not active_game:

            deal_button = pygame.draw.rect(
                screen, 'white', 
                [(self.WIDTH - deal_width) / 2, (self.HEIGHT - deal_height) / 2, deal_width, deal_height], 0, 10
            )
            deal_text = self.FONT.render('DEAL HAND', True, 'black')
            screen.blit(deal_text, deal_text.get_rect(center=deal_button.center))
            buttons.append(deal_button)

            # Draw the bet amount buttons
            button_pair_width = 2 * bet_button_size + bet_button_margin  # Width of one subtract/add pair (button + margin)
            pair_margin = 100  # Customizable spacing between each subtract/add pair

            # Calculate the total width occupied by all pairs with custom spacing
            total_buttons_width = len(bet_amounts) * button_pair_width + (len(bet_amounts) - 1) * pair_margin
            button_start = (self.WIDTH - total_buttons_width) / 2  # Starting x-position to center all pairs

            for i, amount in enumerate(bet_amounts):
                # Calculate x-position for each pair, including the custom pair margin
                x_position = button_start + i * (button_pair_width + pair_margin)
                
                chip_x = x_position + (button_pair_width - chip_size) / 2
                chip_y = self.HEIGHT * 0.6
                chip_image = pygame.image.load(f'img/{amount}chip.png')
                chip_image = pygame.transform.scale(chip_image, (chip_size, chip_size))
                screen.blit(chip_image, (chip_x, chip_y))

                # Draw the subtract button
                subtract_bet_button = pygame.draw.rect(
                    screen, 'white', 
                    [x_position, self.HEIGHT * 0.85, bet_button_size, bet_button_size], 0, 10
                )
                bet_text = self.FONT.render('-', True, 'black')
                screen.blit(bet_text, bet_text.get_rect(center=subtract_bet_button.center))
                
                # Draw the add button, positioned to the right of the subtract button within the pair
                add_bet_button = pygame.draw.rect(
                    screen, 'white', 
                    [x_position + bet_button_size + bet_button_margin, self.HEIGHT * 0.85, bet_button_size, bet_button_size], 0, 10
                )
                bet_text = self.FONT.render('+', True, 'black')
                screen.blit(bet_text, bet_text.get_rect(center=add_bet_button.center))

                # Append the pair to bet_buttons
                bet_buttons.append([subtract_bet_button, add_bet_button])
         
        else:
            # Draw the "Hit" and "Stand" buttons
            hit_button = pygame.draw.rect(
                screen, 'white', 
                [(self.WIDTH / 2) - button_width - margin, self.HEIGHT - button_height - margin, button_width, button_height], 0, 10
            )
            hit_text = self.FONT.render('HIT', True, 'black')
            screen.blit(hit_text, hit_text.get_rect(center=hit_button.center))

            stand_button = pygame.draw.rect(
                screen, 'white', 
                [(self.WIDTH / 2) + margin, self.HEIGHT - button_height - margin, button_width, button_height], 0, 10
            )
            stand_text = self.FONT.render('STAND', True, 'black')
            screen.blit(stand_text, stand_text.get_rect(center=stand_button.center))

            buttons.extend([hit_button, stand_button])

            # Display win/loss/tie records
            score_text = self.FONT.render(f'Wins: {records[0]}  |  Losses: {records[1]}  |  Ties: {records[2]}', True, 'white')
            screen.blit(score_text, (10, 10))

        # If the game has an outcome, display result and "New Hand" button
        if outcome:
            result_text_obj = self.FONT.render(self.results_text[outcome], True, 'white')
            result_text_rect = result_text_obj.get_rect(center=(self.WIDTH / 2, self.HEIGHT * 0.4))
            screen.blit(result_text_obj, result_text_rect)

            restart_button = pygame.draw.rect(
                screen, 'white', 
                [(self.WIDTH - deal_width) / 2, (self.HEIGHT - deal_height) / 2, deal_width, deal_height], 0, 10
            )
            restart_text = self.FONT.render('NEW HAND', True, 'black')
            screen.blit(restart_text, restart_text.get_rect(center=restart_button.center))
            buttons.append(restart_button)

        buttons.append(bet_buttons)
        return buttons

    def draw_amounts(self, active_game, bet_amount, money_amount):
        '''Display the current bet amount on the screen'''
        bet_text = self.FONT.render(f'CURRENT BET: ${bet_amount}', True, 'white')
        money_text = self.FONT.render(f'CURRENT AMOUNT: ${money_amount}', True, 'white')
        
        if active_game:
            bet_rect = bet_text.get_rect(topright=(self.WIDTH - 10, 60))
            money_rect = money_text.get_rect(topright=(self.WIDTH - 10, 10))
        else:
            bet_rect = bet_text.get_rect(center=(self.WIDTH / 2, self.HEIGHT * 0.3))
            money_rect = money_text.get_rect(center=(self.WIDTH / 2, self.HEIGHT * 0.2))

        pygame.display.get_surface().blit(bet_text, bet_rect)
        pygame.display.get_surface().blit(money_text, money_rect)
  
    def dim_screen(self):
        '''Dim the screen before initial deal and when the game is over'''
        dim_surface = pygame.Surface(pygame.display.get_surface().get_size()).convert_alpha()
        dim_surface.fill((0, 0, 0, 175))
        pygame.display.get_surface().blit(dim_surface, (0, 0))

    def shuffle(self):
        '''Shuffle the deck animation'''
        text = ['SHUFFLING', 'SHUFFLING.', 'SHUFFLING..', 'SHUFFLING...']
        self.dim_screen()
        screen = pygame.display.get_surface()
        for t in text:
            screen.fill('darkgreen')  # Replace with your desired background color
            shuffle_text = self.FONT.render(t, True, 'white')
            shuffle_rect = shuffle_text.get_rect(center=(self.WIDTH / 2, self.HEIGHT / 2))
            pygame.display.get_surface().blit(shuffle_text, shuffle_rect)
            pygame.display.flip()
            pygame.time.delay(350)