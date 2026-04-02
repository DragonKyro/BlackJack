import json
import os
import time

import arcade
import arcade.gui
from models import Rules, Deck, Hand, Card
from basic_strategy.tables import lookup_action
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    CARD_SCALE, CARD_SPACING, get_card_texture, make_button,
)

ACTION_NAMES = {'H': 'Hit', 'S': 'Stand', 'D': 'Double', 'P': 'Split', 'R': 'Surrender'}
_ACTION_BAR_Y = 50

STATS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'strategy_stats.json')

# How long to show feedback before auto-dealing (seconds)
FEEDBACK_DURATION = 1.5


def _load_stats():
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    return {
        'total': 0, 'correct': 0, 'incorrect': 0,
        'by_type': {
            'hard': {'total': 0, 'correct': 0},
            'soft': {'total': 0, 'correct': 0},
            'pair': {'total': 0, 'correct': 0},
        },
        'history': [],  # list of {timestamp, correct, hand_type, player_val, dealer_up, your_action, correct_action}
    }


def _save_stats(stats):
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)


def _hand_type(hand, rules):
    cards = hand.cards
    if (len(cards) == 2 and rules.allow_split
            and cards[0].value() == cards[1].value()):
        return 'pair'
    if hand.is_soft():
        return 'soft'
    return 'hard'


class StrategyTrainerView(arcade.View):
    """Rapid-fire basic strategy training. No betting — just decisions."""

    DEALER_Y = 560
    PLAYER_Y = 320
    CARDS_START_X = 380

    def __init__(self, rules=None):
        super().__init__()
        self.rules = rules or Rules()
        self.ui = arcade.gui.UIManager()
        self.deck = Deck(self.rules.num_decks)
        self.stats = _load_stats()

        # Game state
        self.player_hand = Hand()
        self.dealer_up_card = None
        self.dealer_hole_card = None  # kept hidden
        self.state = 'playing'  # 'playing', 'feedback'
        self.correct_action = ''
        self.player_action = ''
        self.was_correct = False
        self.feedback_timer = 0.0

        # Session stats
        self.session_total = 0
        self.session_correct = 0

        # Sprites
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # --- Text objects ---
        self.txt_title = arcade.Text(
            "Strategy Trainer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 25,
            arcade.color.GOLD, font_size=24, anchor_x="center", bold=True,
        )
        self.txt_rules_info = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50,
            (160, 160, 160), font_size=11, anchor_x="center",
        )
        self.txt_dealer_label = arcade.Text(
            "Dealer", 20, self.DEALER_Y + 30,
            arcade.color.WHITE, font_size=16,
        )
        self.txt_player_label = arcade.Text(
            "Player", 20, self.PLAYER_Y + 30,
            arcade.color.WHITE, font_size=16,
        )
        self.txt_player_value = arcade.Text(
            "", 20, self.PLAYER_Y - 35,
            arcade.color.GOLD, font_size=16,
        )
        self.txt_dealer_showing = arcade.Text(
            "", 20, self.DEALER_Y - 35,
            arcade.color.GOLD, font_size=16,
        )
        self.txt_feedback = arcade.Text(
            "", SCREEN_WIDTH / 2, self.PLAYER_Y - 80,
            arcade.color.GREEN, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_session_stats = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 25,
            arcade.color.WHITE, font_size=14, anchor_x="right",
        )
        self.txt_lifetime_stats = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 48,
            (160, 160, 160), font_size=12, anchor_x="right",
        )
        self.txt_key_hints = arcade.Text(
            "", SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )
        self.txt_hand_type = arcade.Text(
            "", 20, self.PLAYER_Y - 55,
            (160, 160, 160), font_size=12,
        )

        # Build rules summary
        parts = [
            f"{self.rules.num_decks}D", self.rules.dealer_17_label(),
            self.rules.blackjack_label(),
        ]
        if self.rules.allow_double:
            parts.append("DAS" if self.rules.allow_double_after_split else "D")
        if self.rules.allow_surrender:
            parts.append("LS")
        if self.rules.allow_split:
            parts.append("SP")
        self.txt_rules_info.text = "  |  ".join(parts)

        self._deal_hand()

    # ------------------------------------------------------------------
    # View lifecycle
    # ------------------------------------------------------------------
    def on_show_view(self):
        self.ui.enable()
        self.window.background_color = FELT_GREEN
        self._setup_playing_ui()

    def on_hide_view(self):
        self.ui.disable()
        _save_stats(self.stats)

    # ------------------------------------------------------------------
    # Dealing
    # ------------------------------------------------------------------
    def _deal_hand(self):
        if self.deck.num_remaining() < self.rules.num_decks * 52 * (1 - self.rules.penetration):
            self.deck.shuffle()

        self.player_hand = Hand()
        self.player_hand.add_card(self.deck.next_card())
        self.dealer_up_card = self.deck.next_card()
        self.player_hand.add_card(self.deck.next_card())
        self.dealer_hole_card = self.deck.next_card()

        self.correct_action = lookup_action(
            self.rules, self.player_hand, self.dealer_up_card.rank,
        )
        self.state = 'playing'
        self.player_action = ''
        self.was_correct = False
        self.feedback_timer = 0.0

        self._build_sprites()

    def _build_sprites(self):
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # Dealer up card
        tex = get_card_texture(self.dealer_up_card.get_image_path())
        s = arcade.Sprite(tex, scale=CARD_SCALE)
        s.center_x = self.CARDS_START_X
        s.center_y = self.DEALER_Y
        self.dealer_sprites.append(s)

        # Dealer hole card (face down)
        tex2 = get_card_texture(Deck.get_back_image_path())
        s2 = arcade.Sprite(tex2, scale=CARD_SCALE)
        s2.center_x = self.CARDS_START_X + CARD_SPACING
        s2.center_y = self.DEALER_Y
        self.dealer_sprites.append(s2)

        # Player cards
        for i, card in enumerate(self.player_hand.cards):
            tex = get_card_texture(card.get_image_path())
            sp = arcade.Sprite(tex, scale=CARD_SCALE)
            sp.center_x = self.CARDS_START_X + i * CARD_SPACING
            sp.center_y = self.PLAYER_Y
            self.player_sprites.append(sp)

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------
    def _anchor_bottom(self, widget):
        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=widget, anchor_x="center_x", anchor_y="bottom",
                    align_y=_ACTION_BAR_Y)
        self.ui.add(anchor)

    def _setup_playing_ui(self):
        self.ui.clear()
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=10)

        hit_btn = make_button("Hit (H)", width=110, height=44)
        stand_btn = make_button("Stand (S)", width=110, height=44)
        hit_btn.on_click = lambda e: self._submit_action('H')
        stand_btn.on_click = lambda e: self._submit_action('S')
        h_box.add(hit_btn)
        h_box.add(stand_btn)

        if self.rules.allow_double:
            dbl_btn = make_button("Double (D)", width=120, height=44)
            dbl_btn.on_click = lambda e: self._submit_action('D')
            h_box.add(dbl_btn)

        if self.rules.allow_split:
            split_btn = make_button("Split (P)", width=110, height=44)
            split_btn.on_click = lambda e: self._submit_action('P')
            h_box.add(split_btn)

        if self.rules.allow_surrender:
            surr_btn = make_button("Surrender (R)", width=140, height=44)
            surr_btn.on_click = lambda e: self._submit_action('R')
            h_box.add(surr_btn)

        self._anchor_bottom(h_box)

        hints = "H  Hit  |  S  Stand"
        if self.rules.allow_double:
            hints += "  |  D  Double"
        if self.rules.allow_split:
            hints += "  |  P  Split"
        if self.rules.allow_surrender:
            hints += "  |  R  Surrender"
        self.txt_key_hints.text = hints + "  |  Esc  Menu"

    def _setup_feedback_ui(self):
        self.ui.clear()
        # No buttons during feedback — auto-advances

    # ------------------------------------------------------------------
    # Action submission
    # ------------------------------------------------------------------
    def _submit_action(self, action):
        if self.state != 'playing':
            return

        self.player_action = action
        self.was_correct = (action == self.correct_action)
        self.state = 'feedback'
        self.feedback_timer = 0.0

        # Update stats
        self.session_total += 1
        self.stats['total'] += 1
        if self.was_correct:
            self.session_correct += 1
            self.stats['correct'] += 1
        else:
            self.stats['incorrect'] += 1

        ht = _hand_type(self.player_hand, self.rules)
        self.stats['by_type'][ht]['total'] += 1
        if self.was_correct:
            self.stats['by_type'][ht]['correct'] += 1

        # Record history entry (keep last 500)
        self.stats['history'].append({
            'ts': int(time.time()),
            'correct': self.was_correct,
            'type': ht,
            'player_val': self.player_hand.value(),
            'dealer_up': str(self.dealer_up_card),
            'your': action,
            'answer': self.correct_action,
        })
        if len(self.stats['history']) > 500:
            self.stats['history'] = self.stats['history'][-500:]

        # Update feedback text
        if self.was_correct:
            self.txt_feedback.text = "Correct!"
            self.txt_feedback.color = arcade.color.GREEN
        else:
            ans = ACTION_NAMES.get(self.correct_action, self.correct_action)
            self.txt_feedback.text = f"Incorrect — correct: {ans}"
            self.txt_feedback.color = arcade.color.RED

        self._setup_feedback_ui()

    # ------------------------------------------------------------------
    # Keyboard
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if self.state == 'playing':
            if key == arcade.key.H:
                self._submit_action('H')
            elif key == arcade.key.S:
                self._submit_action('S')
            elif key == arcade.key.D and self.rules.allow_double:
                self._submit_action('D')
            elif key == arcade.key.P and self.rules.allow_split:
                self._submit_action('P')
            elif key == arcade.key.R and self.rules.allow_surrender:
                self._submit_action('R')
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())
        elif self.state == 'feedback':
            # Any key skips the timer
            if key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())
            else:
                self._next_hand()

    # ------------------------------------------------------------------
    # Update loop
    # ------------------------------------------------------------------
    def on_update(self, delta_time):
        if self.state == 'feedback':
            self.feedback_timer += delta_time
            if self.feedback_timer >= FEEDBACK_DURATION:
                self._next_hand()

    def _next_hand(self):
        self._deal_hand()
        self._setup_playing_ui()

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_rules_info.draw()

        # Labels
        self.txt_dealer_label.draw()
        self.txt_player_label.draw()

        # Cards
        self.dealer_sprites.draw()
        self.player_sprites.draw()

        # Hand info
        self.txt_player_value.text = f"Value: {self.player_hand.value()}"
        self.txt_player_value.draw()

        up_show = "A" if self.dealer_up_card.rank == 'a' else str(self.dealer_up_card.value())
        self.txt_dealer_showing.text = f"Showing: {up_show}"
        self.txt_dealer_showing.draw()

        ht = _hand_type(self.player_hand, self.rules)
        self.txt_hand_type.text = f"Type: {ht.capitalize()}"
        self.txt_hand_type.draw()

        # Session stats
        pct = (self.session_correct / self.session_total * 100) if self.session_total > 0 else 0
        self.txt_session_stats.text = (
            f"Session: {self.session_correct}/{self.session_total}  ({pct:.0f}%)"
        )
        self.txt_session_stats.draw()

        # Lifetime stats
        lt = self.stats['total']
        lc = self.stats['correct']
        lpct = (lc / lt * 100) if lt > 0 else 0
        self.txt_lifetime_stats.text = f"Lifetime: {lc}/{lt}  ({lpct:.0f}%)"
        self.txt_lifetime_stats.draw()

        # Feedback
        if self.state == 'feedback':
            self.txt_feedback.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
