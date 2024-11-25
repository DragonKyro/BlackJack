import copy
import random
import pygame

# Initialize Pygame
pygame.init()

# Constants
CARDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a']
SUITS = ['h', 'd', 'c', 's']
ONE_DECK = [(card, suit) for card in CARDS for suit in SUITS]
DECKS = 6
CARD_WIDTH, CARD_HEIGHT = 150, 210
CARD_GAP = -75

WIDTH, HEIGHT = 1280, 720
screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE  )
pygame.display.set_caption('Blackjack')

FPS = 60
TIMER = pygame.time.Clock()

# Game states and variables
active_game = False
records = [0, 0, 0]  # wins, losses, ties
player_score, dealer_score = 0, 0

initial_deal = False
game_deck = copy.deepcopy(ONE_DECK) * DECKS
player_hand, dealer_hand = [], []
outcome = 0
reveal_dealer = False
hand_active = False

add_score = False
results_text = ['', 'Player Busted o_0', 'Player WINS! :D', 'Dealer WINS! :(', 'Tie... :|']

# Create Fonts Function
def create_fonts():
    '''Create scalable fonts based on the current screen size'''
    global FONT, SMALL_FONT
    FONT = pygame.font.SysFont(None, int(HEIGHT * 0.07))  # 7% of screen height
    SMALL_FONT = pygame.font.SysFont(None, int(HEIGHT * 0.04))  # 4% of screen height

# Deal Card Function
def deal_card(hand, deck):
    '''Deal a card from the deck to the player's or dealer's hand'''

    card = random.choice(deck)
    hand.append(card)
    deck.remove(card)
    return hand, deck

# Draw Scores Function
def draw_scores(player_score, dealer_score):
    '''Draw player and dealer scores on the screen'''

    # Render player score
    player_obj = FONT.render(f'Player Score: {player_score}', True, 'white')
    player_rect = player_obj.get_rect(center=(WIDTH / 2, HEIGHT * 0.8))
    screen.blit(player_obj, player_rect)

    # Render dealer score only if revealed
    if reveal_dealer:
        dealer_obj = FONT.render(f'Dealer Score: {dealer_score}', True, 'white')
        dealer_rect = dealer_obj.get_rect(center=(WIDTH / 2, HEIGHT * 0.15))
        screen.blit(dealer_obj, dealer_rect)

# Draw Cards Function
def draw_cards(player_hand, dealer_hand, reveal):
    '''Display player and dealer cards on the screen'''

    # Calculate card width relative to the screen size and maintain a 5:7 aspect ratio
    card_width = WIDTH * 0.1  # Adjust the multiplier to control card size relative to screen width
    card_height = card_width * (7 / 5)  # Maintain 5:7 width-height ratio

    # Set the card gap relative to card width for consistent spacing
    card_gap = card_width * -0.5

    # Calculate starting positions for centering the cards horizontally
    player_total_width = len(player_hand) * card_width + (len(player_hand) - 1) * card_gap
    dealer_total_width = len(dealer_hand) * card_width + (len(dealer_hand) - 1) * card_gap

    player_start_x = (WIDTH - player_total_width) / 2
    dealer_start_x = (WIDTH - dealer_total_width) / 2

    # Y-positions for the player and dealer hands, relative to screen height
    player_y = HEIGHT * 0.5
    dealer_y = HEIGHT * 0.2

    for i, card in enumerate(player_hand):
        card_image = pygame.image.load(f'img/{card[0]}{card[1]}.png')
        card_image = pygame.transform.scale(card_image, (int(card_width), int(card_height)))
        screen.blit(card_image, (player_start_x + i * (card_width + card_gap), player_y))

    for i, card in enumerate(dealer_hand):
        if i != 0 or reveal:
            card_image = pygame.image.load(f'img/{card[0]}{card[1]}.png')
        else:
            card_image = pygame.image.load('img/back.png')
        card_image = pygame.transform.scale(card_image, (int(card_width), int(card_height)))
        screen.blit(card_image, (dealer_start_x + i * (card_width + card_gap), dealer_y))

# Calculate Score Function
def calculate_score(hand):
    '''Calculate the score for a hand, adjusting Aces from 11 to 1 if necessary'''

    score, aces_count = 0, 0

    for card, _ in hand:
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

# Draw Game Buttons Function
def draw_game_buttons(active, record, result, dim):
    '''Draw game buttons (Deal, Hit, Stand) and display game status'''

    buttons = []
    
    # Calculate relative positions and sizes based on screen dimensions
    deal_width, deal_height = WIDTH * 0.2, HEIGHT * 0.1
    button_width, button_height = WIDTH * 0.15, HEIGHT * 0.1
    margin = HEIGHT * 0.05

    # Dim the screen if needed
    if dim:
        dim_screen()

    if not active:
        deal_button = pygame.draw.rect(
            screen, 'white', 
            [(WIDTH - deal_width) / 2, (HEIGHT - deal_height) / 2, deal_width, deal_height], 0, 10
        )
        deal_text = FONT.render('DEAL HAND', True, 'black')
        screen.blit(deal_text, deal_text.get_rect(center=deal_button.center))
        buttons.append(deal_button)
    else:
        hit_button = pygame.draw.rect(
            screen, 'white', 
            [(WIDTH / 2) - button_width - margin, HEIGHT - button_height - margin, button_width, button_height], 0, 10
        )
        hit_text = FONT.render('HIT', True, 'black')
        screen.blit(hit_text, hit_text.get_rect(center=hit_button.center))

        stand_button = pygame.draw.rect(
            screen, 'white', 
            [(WIDTH / 2) + margin, HEIGHT - button_height - margin, button_width, button_height], 0, 10
        )
        stand_text = FONT.render('STAND', True, 'black')
        screen.blit(stand_text, stand_text.get_rect(center=stand_button.center))

        buttons.extend([hit_button, stand_button])

        # Display win/loss/tie records
        score_text = FONT.render(f'Wins: {record[0]}  |  Losses: {record[1]}  |  Ties: {record[2]}', True, 'white')
        screen.blit(score_text, (10, 10))

    if result:
        result_text_obj = FONT.render(results_text[result], True, 'white')
        result_text_rect = result_text_obj.get_rect(center=(WIDTH / 2, HEIGHT * 0.4))
        screen.blit(result_text_obj, result_text_rect)
        
        restart_button = pygame.draw.rect(
            screen, 'white', 
            [(WIDTH - deal_width) / 2, (HEIGHT - deal_height) / 2, deal_width, deal_height], 0, 10
        )
        restart_text = FONT.render('NEW HAND', True, 'black')
        screen.blit(restart_text, restart_text.get_rect(center=restart_button.center))
        buttons.append(restart_button)

    return buttons

# Check Game End Function
def check_game_end(hand_active, dealer_score, player_score, result, record, add):
    '''Check for endgame conditions and update result and records'''

    if not hand_active and dealer_score >= 17:
        if player_score > 21:
            result = 1
        elif dealer_score < player_score <= 21 or dealer_score > 21:
            result = 2
        elif player_score < dealer_score <= 21:
            result = 3
        else:
            result = 4

        if add:
            if result in [1, 3]:
                record[1] += 1
            elif result == 2:
                record[0] += 1
            else:
                record[2] += 1
            add = False

    return result, record, add

# Dim Screen Function
def dim_screen():
    '''Dim the screen before initial deal and when the game is over'''

    dim_surface = pygame.Surface(screen.get_size()).convert_alpha()
    dim_surface.fill((0, 0, 0, 175))  # RGBA: 128 is the alpha for dimming effect
    screen.blit(dim_surface, (0, 0))

# Main Game Loop
run = True
while run:
    TIMER.tick(FPS)
    create_fonts()
    screen.fill('darkgreen')

    if initial_deal:
        for _ in range(2):
            player_hand, game_deck = deal_card(player_hand, game_deck)
            dealer_hand, game_deck = deal_card(dealer_hand, game_deck)
        initial_deal = False

    if active_game:
        player_score = calculate_score(player_hand)
        draw_cards(player_hand, dealer_hand, reveal_dealer)
        if reveal_dealer:
            dealer_score = calculate_score(dealer_hand)
            if dealer_score < 17:
                dealer_hand, game_deck = deal_card(dealer_hand, game_deck)

        draw_scores(player_score, dealer_score)

    buttons = draw_game_buttons(active_game, records, outcome, dim=not active_game or outcome)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            run = False
        elif event.type == pygame.VIDEORESIZE:
            WIDTH, HEIGHT = event.w, event.h
            screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
        
        if event.type == pygame.MOUSEBUTTONUP:
            if not active_game:
                if buttons[0].collidepoint(event.pos):
                    active_game = True
                    initial_deal = True
                    game_deck = copy.deepcopy(ONE_DECK) * DECKS
                    player_hand, dealer_hand = [], []
                    outcome, hand_active, reveal_dealer = 0, True, False
                    add_score = True
            else:
                if buttons[0].collidepoint(event.pos) and player_score < 21 and hand_active:
                    player_hand, game_deck = deal_card(player_hand, game_deck)
                    player_score = calculate_score(player_hand)
                elif buttons[1].collidepoint(event.pos) and not reveal_dealer:
                    reveal_dealer = True
                    hand_active = False
                elif len(buttons) == 3 and buttons[2].collidepoint(event.pos):
                    active_game = True
                    initial_deal = True
                    game_deck = copy.deepcopy(ONE_DECK) * DECKS
                    player_hand, dealer_hand = [], []
                    outcome, hand_active, reveal_dealer = 0, True, False
                    add_score, dealer_score, player_score = True, 0, 0

    if hand_active and player_score >= 21:
        hand_active = False
        reveal_dealer = True

    outcome, records, add_score = check_game_end(hand_active, dealer_score, player_score, outcome, records, add_score)

    pygame.display.flip()

pygame.quit()