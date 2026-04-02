import arcade
import arcade.gui
import math
from models import Deck, Card
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    CARD_SCALE, get_card_texture, make_button,
)

# Layout — semi-circular table with dealer at top, player seats along arc
TABLE_CX = SCREEN_WIDTH / 2
TABLE_CY = 200
TABLE_RADIUS = 280
DEALER_X = TABLE_CX
DEALER_Y = 620
CARD_SMALL_SCALE = 0.65
CARD_SMALL_SPACING = 55

# Seat positions along a downward arc (left to right)
def _seat_positions(num_seats):
    positions = []
    if num_seats == 1:
        angles = [math.pi / 2]
    else:
        start = math.pi * 0.85
        end = math.pi * 0.15
        angles = [start + (end - start) * i / (num_seats - 1) for i in range(num_seats)]
    for a in angles:
        x = TABLE_CX + TABLE_RADIUS * math.cos(a)
        y = TABLE_CY + TABLE_RADIUS * math.sin(a) * 0.5
        positions.append((x, y))
    return positions


class CountingTrainerView(arcade.View):
    """
    Simulates a casino blackjack table for Hi-Lo counting practice.
    Cards are dealt to multiple hands, and the user is periodically
    asked for the running count.
    """

    def __init__(self, num_decks=6, num_seats=5, deal_speed=1.0, poll_freq=10):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.num_decks = num_decks
        self.num_seats = num_seats
        self.deal_speed = deal_speed  # seconds between cards
        self.poll_freq = poll_freq    # ask count every N cards
        self.deck = Deck(num_decks)
        self.seat_positions = _seat_positions(num_seats)

        # State machine: 'dealing', 'polling', 'result', 'paused', 'finished'
        self.state = 'dealing'
        self.deal_timer = 0.0

        # Cards dealt tracking
        self.cards_dealt_total = 0
        self.cards_since_last_poll = 0
        self.next_poll_at = poll_freq
        self.actual_count = 0  # verified from deck.running_count

        # Current round state
        self.current_round = 0
        self.deal_phase = 'initial'  # 'initial' or 'play'
        self.deal_seat = 0
        self.deal_pass = 0  # 0 = first card per seat, 1 = second

        # Seat hands: list of lists of Cards
        self.seat_cards = [[] for _ in range(num_seats)]
        self.dealer_cards = []

        # All sprite lists
        self.seat_sprite_lists = [arcade.SpriteList() for _ in range(num_seats)]
        self.dealer_sprite_list = arcade.SpriteList()

        # Polling state
        self.user_answer = ""
        self.poll_result_msg = ""
        self.poll_was_correct = False

        # Scoring
        self.polls_total = 0
        self.polls_correct = 0
        self.polls_close = 0  # within +/- 1

        # Text objects
        self.txt_title = arcade.Text(
            "Counting Trainer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 22,
            arcade.color.GOLD, font_size=22, anchor_x="center", bold=True,
        )
        self.txt_info = arcade.Text(
            f"{num_decks} decks  |  {num_seats} seats  |  Speed: {deal_speed:.1f}s",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 46,
            (160, 160, 160), font_size=12, anchor_x="center",
        )
        self.txt_shoe = arcade.Text(
            "", 20, SCREEN_HEIGHT - 22,
            arcade.color.WHITE, font_size=13,
        )
        self.txt_dealt_count = arcade.Text(
            "", 20, SCREEN_HEIGHT - 42,
            (160, 160, 160), font_size=12,
        )
        self.txt_score = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 22,
            arcade.color.WHITE, font_size=13, anchor_x="right",
        )
        self.txt_dealer_label = arcade.Text(
            "Dealer", DEALER_X, DEALER_Y + 55,
            arcade.color.WHITE, font_size=14, anchor_x="center",
        )
        self.txt_poll_prompt = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 40,
            arcade.color.GOLD, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_poll_input = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2,
            arcade.color.WHITE, font_size=36, anchor_x="center", bold=True,
        )
        self.txt_poll_result = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40,
            arcade.color.GREEN, font_size=22, anchor_x="center", bold=True,
        )
        self.txt_key_hints = arcade.Text(
            "Space  Pause/Resume  |  Esc  Menu",
            SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

        self._txt_paused = arcade.Text(
            "PAUSED", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2,
            arcade.color.WHITE, font_size=24,
            anchor_x="center", anchor_y="center", bold=True,
        )

        # Seat label texts
        self.txt_seat_labels = []
        for i, (sx, sy) in enumerate(self.seat_positions):
            self.txt_seat_labels.append(arcade.Text(
                f"Seat {i + 1}", sx, sy - 65,
                (140, 140, 140), font_size=10, anchor_x="center",
            ))

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def on_show_view(self):
        self.ui.enable()
        self.window.background_color = FELT_GREEN
        self._start_new_round()

    def on_hide_view(self):
        self.ui.disable()

    # ------------------------------------------------------------------
    # Round management
    # ------------------------------------------------------------------
    def _start_new_round(self):
        # Check if shoe needs reshuffle
        total_cards = self.num_decks * 52
        if self.deck.num_remaining() < total_cards * 0.25:
            self.deck.shuffle()
            self.actual_count = 0

        self.seat_cards = [[] for _ in range(self.num_seats)]
        self.dealer_cards = []
        self.seat_sprite_lists = [arcade.SpriteList() for _ in range(self.num_seats)]
        self.dealer_sprite_list = arcade.SpriteList()
        self.deal_phase = 'initial'
        self.deal_seat = 0
        self.deal_pass = 0
        self.deal_timer = 0.0
        self.current_round += 1

        if self.state != 'polling':
            self.state = 'dealing'

    def _deal_one_card(self):
        """Deal the next card in the initial deal sequence."""
        if self.deck.num_remaining() == 0:
            self.state = 'finished'
            return

        card = self.deck.next_card()
        self.actual_count = self.deck.running_count
        self.cards_dealt_total += 1
        self.cards_since_last_poll += 1

        if self.deal_phase == 'initial':
            if self.deal_seat < self.num_seats:
                # Deal to seat
                self._add_card_to_seat(self.deal_seat, card)
                self.deal_seat += 1
                if self.deal_seat >= self.num_seats:
                    # Deal to dealer
                    pass
            else:
                # Dealer card
                self._add_card_to_dealer(card)
                self.deal_seat = 0
                self.deal_pass += 1
                if self.deal_pass >= 2:
                    # Initial deal done — start "play" phase (deal random extra cards)
                    self.deal_phase = 'play'
                    self.deal_seat = 0

        elif self.deal_phase == 'play':
            # Simulate play: deal 0-2 extra cards per seat, then finish round
            if self.deal_seat < self.num_seats:
                seat_total = sum(c.value() for c in self.seat_cards[self.deal_seat])
                # Simple sim: hit if under 17
                if seat_total < 17 and len(self.seat_cards[self.deal_seat]) < 5:
                    self._add_card_to_seat(self.deal_seat, card)
                else:
                    self.deal_seat += 1
                    # Re-deal this card to the next eligible seat
                    self._return_and_skip(card)
                    return
            else:
                # Dealer play
                dealer_total = self._dealer_value()
                if dealer_total < 17:
                    self._add_card_to_dealer(card)
                else:
                    # Round over
                    self._start_new_round()
                    return

        # Check if we should poll
        if self.cards_since_last_poll >= self.next_poll_at:
            self._start_poll()

    def _return_and_skip(self, card):
        """Card wasn't used for this seat — try next seats or dealer."""
        while self.deal_seat < self.num_seats:
            seat_total = sum(c.value() for c in self.seat_cards[self.deal_seat])
            if seat_total < 17 and len(self.seat_cards[self.deal_seat]) < 5:
                self._add_card_to_seat(self.deal_seat, card)
                return
            self.deal_seat += 1

        # All seats done, try dealer
        dealer_total = self._dealer_value()
        if dealer_total < 17:
            self._add_card_to_dealer(card)
        else:
            self._start_new_round()

    def _dealer_value(self):
        total = sum(c.value() for c in self.dealer_cards)
        aces = sum(1 for c in self.dealer_cards if c.rank == 'a')
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        return total

    def _add_card_to_seat(self, seat, card):
        self.seat_cards[seat].append(card)
        sx, sy = self.seat_positions[seat]
        idx = len(self.seat_cards[seat]) - 1
        tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
        sprite.center_x = sx - (len(self.seat_cards[seat]) - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
        sprite.center_y = sy
        self.seat_sprite_lists[seat].append(sprite)

    def _add_card_to_dealer(self, card):
        self.dealer_cards.append(card)
        idx = len(self.dealer_cards) - 1
        tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
        sprite.center_x = DEALER_X - (len(self.dealer_cards) - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
        sprite.center_y = DEALER_Y
        self.dealer_sprite_list.append(sprite)

    # ------------------------------------------------------------------
    # Polling
    # ------------------------------------------------------------------
    def _start_poll(self):
        self.state = 'polling'
        self.user_answer = ""
        self.poll_result_msg = ""
        self.txt_poll_prompt.text = "What is the running count?"
        self.txt_poll_input.text = "_"
        self.txt_poll_result.text = ""
        self.cards_since_last_poll = 0
        self.ui.clear()
        self.txt_key_hints.text = "Type number (use - for negative)  |  Enter  Submit"

    def _submit_poll(self):
        try:
            guess = int(self.user_answer)
        except ValueError:
            return

        actual = self.actual_count
        self.polls_total += 1
        diff = abs(guess - actual)

        if guess == actual:
            self.polls_correct += 1
            self.polls_close += 1
            self.poll_was_correct = True
            self.poll_result_msg = f"Correct! RC = {actual}"
            self.txt_poll_result.color = arcade.color.GREEN
        elif diff <= 1:
            self.polls_close += 1
            self.poll_was_correct = False
            self.poll_result_msg = f"Close! RC = {actual} (off by {diff})"
            self.txt_poll_result.color = arcade.color.YELLOW
        else:
            self.poll_was_correct = False
            self.poll_result_msg = f"Wrong. RC = {actual} (you said {guess})"
            self.txt_poll_result.color = arcade.color.RED

        self.txt_poll_result.text = self.poll_result_msg
        self.state = 'result'
        self.deal_timer = 0.0
        self.txt_key_hints.text = "Enter/Space  Continue  |  Esc  Menu"

    # ------------------------------------------------------------------
    # Input
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if self.state == 'polling':
            if key == arcade.key.RETURN or key == arcade.key.ENTER:
                self._submit_poll()
            elif key == arcade.key.BACKSPACE:
                if self.user_answer:
                    self.user_answer = self.user_answer[:-1]
                self.txt_poll_input.text = (self.user_answer or "_")
            elif key == arcade.key.MINUS or key == arcade.key.NUM_SUBTRACT:
                if not self.user_answer:
                    self.user_answer = "-"
                    self.txt_poll_input.text = self.user_answer
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())
            elif arcade.key.KEY_0 <= key <= arcade.key.KEY_9:
                digit = chr(key)
                self.user_answer += digit
                self.txt_poll_input.text = self.user_answer
            elif arcade.key.NUM_0 <= key <= arcade.key.NUM_9:
                digit = str(key - arcade.key.NUM_0)
                self.user_answer += digit
                self.txt_poll_input.text = self.user_answer

        elif self.state == 'result':
            if key in (arcade.key.RETURN, arcade.key.ENTER, arcade.key.SPACE):
                self.state = 'dealing'
                self.txt_key_hints.text = "Space  Pause/Resume  |  Esc  Menu"
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'dealing':
            if key == arcade.key.SPACE:
                self.state = 'paused'
                self.txt_key_hints.text = "Space  Resume  |  Esc  Menu"
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'paused':
            if key == arcade.key.SPACE:
                self.state = 'dealing'
                self.txt_key_hints.text = "Space  Pause/Resume  |  Esc  Menu"
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'finished':
            if key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def on_update(self, delta_time):
        if self.state == 'dealing':
            self.deal_timer += delta_time
            if self.deal_timer >= self.deal_speed:
                self.deal_timer -= self.deal_speed
                self._deal_one_card()

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_info.draw()

        # Shoe info
        total = self.num_decks * 52
        remaining = self.deck.num_remaining()
        self.txt_shoe.text = f"Shoe: {remaining}/{total}"
        self.txt_shoe.draw()
        self.txt_dealt_count.text = f"Cards dealt: {self.cards_dealt_total}"
        self.txt_dealt_count.draw()

        # Score
        pct = (self.polls_correct / self.polls_total * 100) if self.polls_total > 0 else 0
        self.txt_score.text = f"Exact: {self.polls_correct}/{self.polls_total} ({pct:.0f}%)"
        self.txt_score.draw()

        # Draw table felt arc hint
        arcade.draw_arc_outline(
            TABLE_CX, TABLE_CY, TABLE_RADIUS * 2, TABLE_RADIUS,
            (50, 80, 50), 15, 165, 2,
        )

        # Dealer
        self.txt_dealer_label.draw()
        self.dealer_sprite_list.draw()

        # Seats
        for i in range(self.num_seats):
            self.txt_seat_labels[i].draw()
            self.seat_sprite_lists[i].draw()

        # Poll overlay
        if self.state in ('polling', 'result'):
            # Semi-transparent backdrop
            arcade.draw_lrbt_rectangle_filled(
                SCREEN_WIDTH / 2 - 250, SCREEN_WIDTH / 2 + 250,
                SCREEN_HEIGHT / 2 - 70, SCREEN_HEIGHT / 2 + 70,
                (0, 0, 0, 180),
            )
            self.txt_poll_prompt.draw()
            self.txt_poll_input.draw()
            if self.state == 'result':
                self.txt_poll_result.draw()

        # Paused overlay
        if self.state == 'paused':
            arcade.draw_lrbt_rectangle_filled(
                SCREEN_WIDTH / 2 - 100, SCREEN_WIDTH / 2 + 100,
                SCREEN_HEIGHT / 2 - 25, SCREEN_HEIGHT / 2 + 25,
                (0, 0, 0, 180),
            )
            self._txt_paused.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
