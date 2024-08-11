import pygame
import random

# Initialize Pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('Blackjack')

# testing git

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 128, 0)

# Font
font = pygame.font.SysFont(None, 55)

# Card values
VALUES = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11}
SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades']
CARDS = [f'{value} of {suit}' for value in VALUES.keys() for suit in SUITS]

# Deck
deck = CARDS * 6  # Multiple decks for simplicity

def draw_text(text, font, color, surface, x, y):
    textobj = font.render(text, True, color)
    textrect = textobj.get_rect()
    textrect.center = (x, y)
    surface.blit(textobj, textrect)

def calculate_hand_value(hand):
    value = 0
    num_aces = 0
    for card in hand:
        card_value = card.split()[0]
        value += VALUES[card_value]
        if card_value == 'A':
            num_aces += 1
    while value > 21 and num_aces:
        value -= 10
        num_aces -= 1
    return value

def draw_hand(hand, offset_x, offset_y):
    for i, card in enumerate(hand):
        draw_text(card, font, WHITE, screen, offset_x, offset_y + i * 40)

def main():
    clock = pygame.time.Clock()
    running = True

    # Initial hands
    player_hand = [deck.pop(random.randint(0, len(deck) - 1)) for _ in range(2)]
    dealer_hand = [deck.pop(random.randint(0, len(deck) - 1)) for _ in range(2)]

    while running:
        screen.fill(GREEN)
        draw_text('Blackjack', font, WHITE, screen, WIDTH // 2, 50)

        draw_text('Player Hand:', font, WHITE, screen, 150, 200)
        draw_hand(player_hand, 150, 250)
        player_value = calculate_hand_value(player_hand)
        draw_text(f'Value: {player_value}', font, WHITE, screen, 150, 350)

        draw_text('Dealer Hand:', font, WHITE, screen, 500, 200)
        draw_hand(dealer_hand, 500, 250)
        dealer_value = calculate_hand_value(dealer_hand)
        draw_text(f'Value: {dealer_value}', font, WHITE, screen, 500, 350)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_q:  # Quit
                    running = False
                if event.key == pygame.K_h:  # Hit
                    player_hand.append(deck.pop(random.randint(0, len(deck) - 1)))
                    player_value = calculate_hand_value(player_hand)
                    if player_value > 21:
                        draw_text('Player Bust!', font, WHITE, screen, WIDTH // 2, HEIGHT // 2)
                        pygame.display.update()
                        pygame.time.wait(2000)
                        running = False
                if event.key == pygame.K_s:  # Stand
                    while calculate_hand_value(dealer_hand) < 17:
                        dealer_hand.append(deck.pop(random.randint(0, len(deck) - 1)))
                    dealer_value = calculate_hand_value(dealer_hand)
                    if dealer_value > 21:
                        draw_text('Dealer Bust! You Win!', font, WHITE, screen, WIDTH // 2, HEIGHT // 2)
                    elif dealer_value > player_value:
                        draw_text('Dealer Wins!', font, WHITE, screen, WIDTH // 2, HEIGHT // 2)
                    elif dealer_value < player_value:
                        draw_text('You Win!', font, WHITE, screen, WIDTH // 2, HEIGHT // 2)
                    else:
                        draw_text('Push! Tie!', font, WHITE, screen, WIDTH // 2, HEIGHT // 2)
                    pygame.display.update()
                    pygame.time.wait(2000)
                    running = False

        pygame.display.update()
        clock.tick(30)

    pygame.quit()

if __name__ == '__main__':
    main()
