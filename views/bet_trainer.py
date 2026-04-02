import math
import arcade
import arcade.gui
from models import Deck, Hand, Rules
from utils.bet_spread import BetSpread
from basic_strategy.tables import lookup_action
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    CARD_SCALE, get_card_texture, make_button,
)

# Layout
TABLE_CX = SCREEN_WIDTH / 2
TABLE_CY = 180
TABLE_RADIUS = 260
DEALER_X = TABLE_CX
DEALER_Y = 580
CARD_SMALL_SCALE = 0.60
CARD_SMALL_SPACING = 50
SHOE_X = SCREEN_WIDTH - 80
SHOE_Y = SCREEN_HEIGHT - 60
ANIM_DURATION = 0.18
_ACTION_BAR_Y = 50


def _seat_positions(n):
    if n == 1:
        return [(TABLE_CX, TABLE_CY + TABLE_RADIUS * 0.5)]
    positions = []
    start, end = math.pi * 0.82, math.pi * 0.18
    for i in range(n):
        a = start + (end - start) * i / (n - 1)
        x = TABLE_CX + TABLE_RADIUS * math.cos(a)
        y = TABLE_CY + TABLE_RADIUS * math.sin(a) * 0.45
        positions.append((x, y))
    return positions


class _CardAnim:
    __slots__ = ('sprite', 'start_x', 'start_y', 'end_x', 'end_y',
                 'duration', 'elapsed', 'done')

    def __init__(self, sprite, end_x, end_y):
        self.sprite = sprite
        self.start_x = SHOE_X
        self.start_y = SHOE_Y
        self.end_x = end_x
        self.end_y = end_y
        self.duration = ANIM_DURATION
        self.elapsed = 0.0
        self.done = False


class BetTrainerView(arcade.View):
    """
    Bet spread trainer. Hands deal and play automatically. Between rounds
    the user is asked for the true count and their bet. The bet is validated
    against the configured spread.
    """

    def __init__(self, rules=None, spread=None, num_seats=3, deal_speed=0.8):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = rules or Rules()
        self.spread = spread or BetSpread()
        self.num_seats = num_seats
        self.deal_speed = deal_speed
        self.deck = Deck(self.rules.num_decks)
        self.seat_positions = _seat_positions(num_seats)

        # ---- State machine ----
        # 'betting'     → user inputs TC + bet
        # 'dealing'     → timed card-by-card deal
        # 'animating'   → card flying
        # 'playing'     → auto-play seats one at a time
        # 'play_anim'   → animating a hit card during play
        # 'dealer_play' → dealer drawing
        # 'round_result'→ brief pause showing outcome
        self.state = 'betting'
        self.deal_timer = 0.0
        self.result_timer = 0.0

        # Deck / counting
        self.actual_rc = 0
        self.cards_dealt_total = 0

        # Round tracking
        self.round_num = 0
        self.deal_phase = 'initial'
        self.deal_seat = 0
        self.deal_pass = 0

        # Seat data: list of Hand objects
        self.seat_hands = [Hand() for _ in range(num_seats)]
        self.dealer_hand = Hand()

        # Sprites
        self.seat_sprite_lists = [arcade.SpriteList() for _ in range(num_seats)]
        self.dealer_sprite_list = arcade.SpriteList()

        # Animation
        self._current_anim = None
        self._anim_callback = None

        # Auto-play state
        self._play_seat_idx = 0

        # Betting prompt state
        self.user_tc_input = ""
        self.user_bet_input = ""
        self.input_field = 'tc'  # 'tc' or 'bet'
        self.bet_feedback_msg = ""
        self.bet_was_correct = True

        # Scoring
        self.bets_total = 0
        self.bets_correct = 0
        self.tc_checks_total = 0
        self.tc_checks_correct = 0

        # ---- Text objects ----
        self.txt_title = arcade.Text(
            "Bet Trainer", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 20,
            arcade.color.GOLD, font_size=20, anchor_x="center", bold=True,
        )
        self.txt_shoe = arcade.Text(
            "", 20, SCREEN_HEIGHT - 20, arcade.color.WHITE, font_size=12,
        )
        self.txt_dealt = arcade.Text(
            "", 20, SCREEN_HEIGHT - 38, (160, 160, 160), font_size=11,
        )
        self.txt_score = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 20,
            arcade.color.WHITE, font_size=12, anchor_x="right",
        )
        self.txt_tc_score = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 38,
            (160, 160, 160), font_size=11, anchor_x="right",
        )
        self.txt_dealer_label = arcade.Text(
            "Dealer", DEALER_X, DEALER_Y + 48,
            arcade.color.WHITE, font_size=13, anchor_x="center",
        )
        self.txt_key_hints = arcade.Text(
            "", SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

        # Betting prompt texts
        self.txt_prompt_tc = arcade.Text(
            "Running Count:", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 55,
            arcade.color.GOLD, font_size=22, anchor_x="center", bold=True,
        )
        self.txt_input_tc = arcade.Text(
            "_", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 25,
            arcade.color.WHITE, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_prompt_bet = arcade.Text(
            "Your Bet (units):", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 15,
            arcade.color.GOLD, font_size=22, anchor_x="center", bold=True,
        )
        self.txt_input_bet = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 45,
            arcade.color.WHITE, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_bet_feedback = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 85,
            arcade.color.GREEN, font_size=20, anchor_x="center", bold=True,
        )
        self.txt_round_result = arcade.Text(
            "", SCREEN_WIDTH / 2, 110,
            arcade.color.WHITE, font_size=16, anchor_x="center",
        )

        # Seat labels
        self.txt_seat_labels = []
        for i, (sx, sy) in enumerate(self.seat_positions):
            self.txt_seat_labels.append(arcade.Text(
                f"Seat {i + 1}", sx, sy - 55,
                (140, 140, 140), font_size=10, anchor_x="center",
            ))

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def on_show_view(self):
        self.ui.enable()
        self.window.background_color = FELT_GREEN
        self._setup_betting_prompt()

    def on_hide_view(self):
        self.ui.disable()

    # ------------------------------------------------------------------
    # Animation
    # ------------------------------------------------------------------
    @property
    def _animating(self):
        return self._current_anim is not None and not self._current_anim.done

    def _animate_card(self, sprite, end_x, end_y, callback=None):
        sprite.visible = False
        sprite.center_x = SHOE_X
        sprite.center_y = SHOE_Y
        self._current_anim = _CardAnim(sprite, end_x, end_y)
        self._anim_callback = callback

    def _tick_anim(self, dt):
        a = self._current_anim
        if a is None or a.done:
            return
        a.elapsed += dt
        a.sprite.visible = True
        t = min(a.elapsed / a.duration, 1.0)
        ease = 1 - (1 - t) ** 2
        a.sprite.center_x = a.start_x + (a.end_x - a.start_x) * ease
        a.sprite.center_y = a.start_y + (a.end_y - a.start_y) * ease
        if t >= 1.0:
            a.done = True
            a.sprite.center_x = a.end_x
            a.sprite.center_y = a.end_y
            self._current_anim = None
            if self._anim_callback:
                cb = self._anim_callback
                self._anim_callback = None
                cb()

    # ------------------------------------------------------------------
    # Betting prompt
    # ------------------------------------------------------------------
    def _setup_betting_prompt(self):
        self.state = 'betting'
        self.input_field = 'tc'
        self.user_tc_input = ""
        self.user_bet_input = ""
        self.bet_feedback_msg = ""
        self.txt_input_tc.text = "_"
        self.txt_input_tc.color = arcade.color.WHITE
        self.txt_input_bet.text = ""
        self.txt_input_bet.color = (120, 120, 120)
        self.txt_prompt_bet.color = (120, 120, 120)
        self.txt_prompt_tc.color = arcade.color.GOLD
        self.txt_bet_feedback.text = ""
        self.ui.clear()
        self.txt_key_hints.text = "Type number  |  Tab  Switch field  |  Enter  Submit  |  Esc  Menu"

    def _submit_betting(self):
        # Parse TC
        try:
            user_tc = int(self.user_tc_input)
        except ValueError:
            return
        # Parse bet
        try:
            user_bet = int(self.user_bet_input)
        except ValueError:
            return

        # Evaluate TC accuracy
        actual_tc = int(round(self.deck.true_count()))
        self.tc_checks_total += 1
        tc_correct = (user_tc == actual_tc)
        tc_close = abs(user_tc - actual_tc) <= 1
        if tc_correct:
            self.tc_checks_correct += 1

        # Evaluate bet accuracy — compare against spread at actual TC
        correct_bet = self.spread.get_bet(actual_tc)
        self.bets_total += 1
        self.bets_correct += (user_bet == correct_bet)

        # Build feedback
        parts = []
        if tc_correct:
            parts.append(f"TC: Correct ({actual_tc})")
        elif tc_close:
            parts.append(f"TC: Close — actual {actual_tc}")
        else:
            parts.append(f"TC: Wrong — actual {actual_tc}")

        if user_bet == correct_bet:
            parts.append(f"Bet: Correct ({correct_bet}u)")
            self.txt_bet_feedback.color = arcade.color.GREEN
        else:
            parts.append(f"Bet: Should be {correct_bet}u (you said {user_bet}u)")
            self.txt_bet_feedback.color = arcade.color.RED

        self.bet_feedback_msg = "  |  ".join(parts)
        self.txt_bet_feedback.text = self.bet_feedback_msg

        # Brief pause then start dealing
        self.state = 'bet_result'
        self.result_timer = 0.0

    # ------------------------------------------------------------------
    # Dealing
    # ------------------------------------------------------------------
    def _start_round(self):
        # Reshuffle check
        total = self.rules.num_decks * 52
        threshold = total * (1 - self.rules.penetration)
        if self.deck.num_remaining() < threshold:
            self.deck.shuffle()

        self.round_num += 1
        self.seat_hands = [Hand() for _ in range(self.num_seats)]
        self.dealer_hand = Hand()
        self.seat_sprite_lists = [arcade.SpriteList() for _ in range(self.num_seats)]
        self.dealer_sprite_list = arcade.SpriteList()
        self.deal_phase = 'initial'
        self.deal_seat = 0
        self.deal_pass = 0
        self.deal_timer = 0.0
        self.state = 'dealing'
        self.txt_round_result.text = ""

    def _deal_one_card(self):
        if self.deck.num_remaining() == 0:
            self.deck.shuffle()

        card = self.deck.next_card()
        self.actual_rc = self.deck.running_count
        self.cards_dealt_total += 1

        if self.deal_phase == 'initial':
            if self.deal_seat < self.num_seats:
                self._add_seat_card_animated(self.deal_seat, card)
                self.deal_seat += 1
            else:
                self._add_dealer_card_animated(card)
                self.deal_seat = 0
                self.deal_pass += 1
                if self.deal_pass >= 2:
                    self.deal_phase = 'done'

    def _on_deal_card_done(self):
        if self.deal_phase == 'done':
            self._start_auto_play()
        else:
            self.state = 'dealing'

    def _add_seat_card_animated(self, seat, card):
        self.seat_hands[seat].add_card(card)
        sx, sy = self.seat_positions[seat]
        n = len(self.seat_hands[seat].cards)
        idx = n - 1
        tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
        target_x = sx - (n - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
        target_y = sy
        self.seat_sprite_lists[seat].append(sprite)
        for j in range(n - 1):
            self.seat_sprite_lists[seat][j].center_x = (
                sx - (n - 1) * CARD_SMALL_SPACING / 2 + j * CARD_SMALL_SPACING
            )
        self.state = 'animating'
        self._animate_card(sprite, target_x, target_y, self._on_deal_card_done)

    def _add_dealer_card_animated(self, card):
        self.dealer_hand.add_card(card)
        n = len(self.dealer_hand.cards)
        idx = n - 1
        # Second dealer card face down
        if idx == 1:
            tex = get_card_texture(Deck.get_back_image_path())
        else:
            tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
        target_x = DEALER_X - (n - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
        target_y = DEALER_Y
        self.dealer_sprite_list.append(sprite)
        for j in range(n - 1):
            self.dealer_sprite_list[j].center_x = (
                DEALER_X - (n - 1) * CARD_SMALL_SPACING / 2 + j * CARD_SMALL_SPACING
            )
        self.state = 'animating'
        self._animate_card(sprite, target_x, target_y, self._on_deal_card_done)

    # ------------------------------------------------------------------
    # Auto-play via basic strategy
    # ------------------------------------------------------------------
    def _start_auto_play(self):
        self._play_seat_idx = 0
        self._play_next_seat()

    def _play_next_seat(self):
        if self._play_seat_idx >= self.num_seats:
            self._start_dealer_play()
            return

        hand = self.seat_hands[self._play_seat_idx]
        dealer_up = self.dealer_hand.cards[0]
        action = lookup_action(self.rules, hand, dealer_up.rank)

        if action == 'H' and hand.value() < 21:
            self.state = 'play_anim'
            card = self.deck.next_card()
            self.actual_rc = self.deck.running_count
            self.cards_dealt_total += 1
            hand.add_card(card)
            seat = self._play_seat_idx
            sx, sy = self.seat_positions[seat]
            n = len(hand.cards)
            idx = n - 1
            tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
            target_x = sx - (n - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
            target_y = sy
            self.seat_sprite_lists[seat].append(sprite)
            for j in range(n - 1):
                self.seat_sprite_lists[seat][j].center_x = (
                    sx - (n - 1) * CARD_SMALL_SPACING / 2 + j * CARD_SMALL_SPACING
                )
            self._animate_card(sprite, target_x, target_y, self._on_play_card_done)
        elif action == 'D' and hand.value() < 21 and len(hand.cards) == 2:
            # Double: one more card then move on
            self.state = 'play_anim'
            card = self.deck.next_card()
            self.actual_rc = self.deck.running_count
            self.cards_dealt_total += 1
            hand.add_card(card)
            seat = self._play_seat_idx
            sx, sy = self.seat_positions[seat]
            n = len(hand.cards)
            idx = n - 1
            tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
            target_x = sx - (n - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
            target_y = sy
            self.seat_sprite_lists[seat].append(sprite)
            for j in range(n - 1):
                self.seat_sprite_lists[seat][j].center_x = (
                    sx - (n - 1) * CARD_SMALL_SPACING / 2 + j * CARD_SMALL_SPACING
                )
            self._animate_card(sprite, target_x, target_y, self._on_double_done)
        else:
            # Stand, Surrender, or bust — move to next seat
            self._play_seat_idx += 1
            self._play_next_seat()

    def _on_play_card_done(self):
        """After a hit card animation, re-evaluate."""
        hand = self.seat_hands[self._play_seat_idx]
        if hand.is_bust() or hand.value() >= 21:
            self._play_seat_idx += 1
            self._play_next_seat()
        else:
            self._play_next_seat()

    def _on_double_done(self):
        self._play_seat_idx += 1
        self._play_next_seat()

    # ------------------------------------------------------------------
    # Dealer play
    # ------------------------------------------------------------------
    def _start_dealer_play(self):
        # Reveal hole card
        if len(self.dealer_sprite_list) >= 2:
            hole = self.dealer_hand.cards[1]
            tex = get_card_texture(hole.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
            sprite.center_x = self.dealer_sprite_list[1].center_x
            sprite.center_y = self.dealer_sprite_list[1].center_y
            self.dealer_sprite_list[1] = sprite

        self.state = 'dealer_play'
        self._dealer_draw_next()

    def _dealer_draw_next(self):
        hits_soft_17 = self.rules.dealer_hits_soft_17
        val = self.dealer_hand.value()
        is_soft = self.dealer_hand.is_soft()
        should_hit = val < 17 or (hits_soft_17 and val == 17 and is_soft)

        if not should_hit:
            self._finish_round()
            return

        card = self.deck.next_card()
        self.actual_rc = self.deck.running_count
        self.cards_dealt_total += 1
        self.dealer_hand.add_card(card)

        n = len(self.dealer_hand.cards)
        idx = n - 1
        tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SMALL_SCALE)
        target_x = DEALER_X - (n - 1) * CARD_SMALL_SPACING / 2 + idx * CARD_SMALL_SPACING
        target_y = DEALER_Y
        self.dealer_sprite_list.append(sprite)
        for j in range(n - 1):
            self.dealer_sprite_list[j].center_x = (
                DEALER_X - (n - 1) * CARD_SMALL_SPACING / 2 + j * CARD_SMALL_SPACING
            )
        self.state = 'animating'
        self._animate_card(sprite, target_x, target_y, self._dealer_draw_next)

    # ------------------------------------------------------------------
    # Round finish
    # ------------------------------------------------------------------
    def _finish_round(self):
        dealer_val = self.dealer_hand.value()
        dealer_bust = self.dealer_hand.is_bust()
        results = []
        for i in range(self.num_seats):
            pv = self.seat_hands[i].value()
            if self.seat_hands[i].is_bust():
                results.append("Bust")
            elif dealer_bust:
                results.append("Win")
            elif pv > dealer_val:
                results.append("Win")
            elif pv < dealer_val:
                results.append("Lose")
            else:
                results.append("Push")

        summary = "  |  ".join(f"S{i+1}: {r}" for i, r in enumerate(results))
        d_str = f"Dealer: {dealer_val}" + (" (Bust)" if dealer_bust else "")
        self.txt_round_result.text = f"{d_str}  —  {summary}"
        self.state = 'round_result'
        self.result_timer = 0.0

    # ------------------------------------------------------------------
    # Input
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if self.state == 'betting':
            if key == arcade.key.TAB:
                self._toggle_input_field()
            elif key == arcade.key.RETURN or key == arcade.key.ENTER:
                self._submit_betting()
            elif key == arcade.key.BACKSPACE:
                self._backspace_input()
            elif key == arcade.key.MINUS or key == arcade.key.NUM_SUBTRACT:
                self._type_char('-')
            elif arcade.key.KEY_0 <= key <= arcade.key.KEY_9:
                self._type_char(chr(key))
            elif arcade.key.NUM_0 <= key <= arcade.key.NUM_9:
                self._type_char(str(key - arcade.key.NUM_0))
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'bet_result':
            if key in (arcade.key.RETURN, arcade.key.ENTER, arcade.key.SPACE):
                self._start_round()
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'round_result':
            if key in (arcade.key.RETURN, arcade.key.ENTER, arcade.key.SPACE):
                self._setup_betting_prompt()
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state in ('dealing', 'animating', 'playing', 'play_anim', 'dealer_play'):
            if key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

    def _toggle_input_field(self):
        if self.input_field == 'tc':
            self.input_field = 'bet'
            self.txt_prompt_tc.color = (120, 120, 120)
            self.txt_input_tc.color = (120, 120, 120)
            self.txt_prompt_bet.color = arcade.color.GOLD
            self.txt_input_bet.color = arcade.color.WHITE
            if not self.user_bet_input:
                self.txt_input_bet.text = "_"
        else:
            self.input_field = 'tc'
            self.txt_prompt_tc.color = arcade.color.GOLD
            self.txt_input_tc.color = arcade.color.WHITE
            self.txt_prompt_bet.color = (120, 120, 120)
            self.txt_input_bet.color = (120, 120, 120)

    def _type_char(self, ch):
        if self.input_field == 'tc':
            if ch == '-' and self.user_tc_input:
                return
            self.user_tc_input += ch
            self.txt_input_tc.text = self.user_tc_input
        else:
            if ch == '-':
                return  # no negative bets
            self.user_bet_input += ch
            self.txt_input_bet.text = self.user_bet_input

    def _backspace_input(self):
        if self.input_field == 'tc':
            self.user_tc_input = self.user_tc_input[:-1]
            self.txt_input_tc.text = self.user_tc_input or "_"
        else:
            self.user_bet_input = self.user_bet_input[:-1]
            self.txt_input_bet.text = self.user_bet_input or "_"

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def on_update(self, delta_time):
        if self._animating:
            self._tick_anim(delta_time)
            return

        if self.state == 'dealing':
            self.deal_timer += delta_time
            if self.deal_timer >= self.deal_speed:
                self.deal_timer -= self.deal_speed
                self._deal_one_card()

        elif self.state == 'bet_result':
            self.result_timer += delta_time
            if self.result_timer >= 2.0:
                self._start_round()

        elif self.state == 'round_result':
            self.result_timer += delta_time
            if self.result_timer >= 2.5:
                self._setup_betting_prompt()

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()

        # Shoe / score
        total = self.rules.num_decks * 52
        remaining = self.deck.num_remaining()
        self.txt_shoe.text = f"Shoe: {remaining}/{total}  (~{remaining / 52:.1f}D)"
        self.txt_shoe.draw()
        self.txt_dealt.text = f"Round {self.round_num}  |  Cards: {self.cards_dealt_total}"
        self.txt_dealt.draw()

        bpct = (self.bets_correct / self.bets_total * 100) if self.bets_total > 0 else 0
        self.txt_score.text = f"Bets: {self.bets_correct}/{self.bets_total} ({bpct:.0f}%)"
        self.txt_score.draw()
        tcpct = (self.tc_checks_correct / self.tc_checks_total * 100) if self.tc_checks_total > 0 else 0
        self.txt_tc_score.text = f"TC: {self.tc_checks_correct}/{self.tc_checks_total} ({tcpct:.0f}%)"
        self.txt_tc_score.draw()

        # Table arc
        arcade.draw_arc_outline(
            TABLE_CX, TABLE_CY, TABLE_RADIUS * 2, TABLE_RADIUS * 0.9,
            (50, 80, 50), 15, 165, 2,
        )

        # Dealer
        self.txt_dealer_label.draw()
        self.dealer_sprite_list.draw()

        # Seats
        for i in range(self.num_seats):
            self.txt_seat_labels[i].draw()
            self.seat_sprite_lists[i].draw()

        # Betting overlay
        if self.state in ('betting', 'bet_result'):
            arcade.draw_lrbt_rectangle_filled(
                SCREEN_WIDTH / 2 - 280, SCREEN_WIDTH / 2 + 280,
                SCREEN_HEIGHT / 2 - 105, SCREEN_HEIGHT / 2 + 80,
                (0, 0, 0, 200),
            )
            self.txt_prompt_tc.draw()
            self.txt_input_tc.draw()
            self.txt_prompt_bet.draw()
            self.txt_input_bet.draw()
            if self.state == 'bet_result':
                self.txt_bet_feedback.draw()

        # Round result
        if self.state == 'round_result' and self.txt_round_result.text:
            self.txt_round_result.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
