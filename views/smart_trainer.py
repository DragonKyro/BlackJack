import arcade
import arcade.gui
from models import Rules, Deck, Hand
from bet_spread import BetSpread
from basic_strategy.tables import lookup_action
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    CARD_SCALE, CARD_SPACING, get_card_texture, make_button,
)

ACTION_NAMES = {'H': 'Hit', 'S': 'Stand', 'D': 'Double', 'P': 'Split', 'R': 'Surrender'}

SHOE_X = SCREEN_WIDTH - 100
SHOE_Y = SCREEN_HEIGHT - 80
ANIM_DURATION = 0.18
ANIM_STAGGER = 0.12
_ACTION_BAR_Y = 50


class _CardAnim:
    __slots__ = ('sprite', 'start_x', 'start_y', 'end_x', 'end_y',
                 'duration', 'delay', 'done')

    def __init__(self, sprite, end_x, end_y, delay=0.0):
        self.sprite = sprite
        self.start_x = SHOE_X
        self.start_y = SHOE_Y
        self.end_x = end_x
        self.end_y = end_y
        self.duration = ANIM_DURATION
        self.delay = delay
        self.done = False


class SmartTrainerView(arcade.View):
    """
    Combined trainer: user must count, bet correctly, AND play basic strategy.
    Flow per round:
      1. 'betting' — user inputs RC + bet (validated against spread)
      2. 'bet_feedback' — shows bet/TC feedback briefly
      3. 'animating' — deal animation
      4. 'playing' — user plays hand (H/S/D/R), each action validated
      5. 'dealer_turn' — dealer plays automatically
      6. 'result' — round outcome shown, auto-advance
    """

    DEALER_Y = 570
    PLAYER_Y = 310
    CARDS_START_X = 350

    def __init__(self, rules=None, spread=None):
        super().__init__()
        self.rules = rules or Rules()
        self.spread = spread or BetSpread()
        self.ui = arcade.gui.UIManager()
        self.deck = Deck(self.rules.num_decks)

        self.state = 'betting'
        self.round_num = 0

        # Hands
        self.player_hand = Hand()
        self.dealer_hand = Hand()

        # Sprites
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # Animation
        self._animations = []
        self._anim_time = 0.0
        self._anim_callback = None

        # Betting prompt
        self.user_tc_input = ""
        self.user_bet_input = ""
        self.input_field = 'tc'
        self.bet_feedback_msg = ""
        self.bet_feedback_timer = 0.0

        # Play feedback
        self.play_feedback_msg = ""
        self.play_feedback_timer = 0.0

        # Result
        self.result_msg = ""
        self.result_timer = 0.0

        # Scoring
        self.rounds_played = 0
        self.tc_correct = 0
        self.tc_total = 0
        self.bet_correct = 0
        self.bet_total = 0
        self.play_correct = 0
        self.play_total = 0

        # --- Text objects ---
        self.txt_title = arcade.Text(
            "Smart Trainer", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 22,
            arcade.color.GOLD, font_size=20, anchor_x="center", bold=True,
        )
        self.txt_shoe = arcade.Text(
            "", 20, SCREEN_HEIGHT - 22, arcade.color.WHITE, font_size=12,
        )
        self.txt_score = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 22,
            arcade.color.WHITE, font_size=11, anchor_x="right",
        )
        self.txt_score2 = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 40,
            (160, 160, 160), font_size=11, anchor_x="right",
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
            "", 20, self.PLAYER_Y - 35, arcade.color.GOLD, font_size=16,
        )
        self.txt_dealer_showing = arcade.Text(
            "", 20, self.DEALER_Y - 35, arcade.color.GOLD, font_size=16,
        )
        self.txt_key_hints = arcade.Text(
            "", SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )
        # Betting prompt
        self.txt_prompt_tc = arcade.Text(
            "Running Count:", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 55,
            arcade.color.GOLD, font_size=22, anchor_x="center", bold=True,
        )
        self.txt_input_tc = arcade.Text(
            "_", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 25,
            arcade.color.WHITE, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_prompt_bet = arcade.Text(
            "Bet (units):", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 15,
            (120, 120, 120), font_size=22, anchor_x="center", bold=True,
        )
        self.txt_input_bet = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 45,
            (120, 120, 120), font_size=28, anchor_x="center", bold=True,
        )
        self.txt_bet_feedback = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 85,
            arcade.color.GREEN, font_size=18, anchor_x="center", bold=True,
        )
        # Play feedback (shown briefly after each action)
        self.txt_play_feedback = arcade.Text(
            "", SCREEN_WIDTH / 2, self.PLAYER_Y - 75,
            arcade.color.GREEN, font_size=22, anchor_x="center", bold=True,
        )
        # Round result
        self.txt_result = arcade.Text(
            "", SCREEN_WIDTH / 2, self.PLAYER_Y - 105,
            arcade.color.GOLD, font_size=26, anchor_x="center", bold=True,
        )

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
        return len(self._animations) > 0

    def _queue_anim(self, sprite, end_x, end_y, delay=0.0):
        sprite.visible = False
        sprite.center_x = SHOE_X
        sprite.center_y = SHOE_Y
        self._animations.append(_CardAnim(sprite, end_x, end_y, delay))

    def _start_anims(self, callback=None):
        self._anim_time = 0.0
        self._anim_callback = callback
        self.state = 'animating'
        self.ui.clear()

    def _tick_anims(self, dt):
        if not self._animations:
            return
        self._anim_time += dt
        all_done = True
        for a in self._animations:
            if a.done:
                continue
            if self._anim_time < a.delay:
                all_done = False
                continue
            all_done = False
            a.sprite.visible = True
            elapsed = self._anim_time - a.delay
            t = min(elapsed / a.duration, 1.0)
            ease = 1 - (1 - t) ** 2
            a.sprite.center_x = a.start_x + (a.end_x - a.start_x) * ease
            a.sprite.center_y = a.start_y + (a.end_y - a.start_y) * ease
            if t >= 1.0:
                a.done = True
                a.sprite.center_x = a.end_x
                a.sprite.center_y = a.end_y
        if all_done:
            self._animations.clear()
            if self._anim_callback:
                cb = self._anim_callback
                self._anim_callback = None
                cb()

    # ------------------------------------------------------------------
    # Betting phase
    # ------------------------------------------------------------------
    def _setup_betting_prompt(self):
        self.state = 'betting'
        self.input_field = 'tc'
        self.user_tc_input = ""
        self.user_bet_input = ""
        self.bet_feedback_msg = ""
        self.play_feedback_msg = ""
        self.result_msg = ""
        self.txt_input_tc.text = "_"
        self.txt_input_tc.color = arcade.color.WHITE
        self.txt_input_bet.text = ""
        self.txt_input_bet.color = (120, 120, 120)
        self.txt_prompt_bet.color = (120, 120, 120)
        self.txt_prompt_tc.color = arcade.color.GOLD
        self.txt_bet_feedback.text = ""
        self.txt_play_feedback.text = ""
        self.txt_result.text = ""
        self.ui.clear()
        self.txt_key_hints.text = "Type number  |  Tab  Switch  |  Enter  Submit  |  Esc  Menu"

    def _submit_betting(self):
        try:
            user_tc = int(self.user_tc_input)
        except ValueError:
            return
        try:
            user_bet = int(self.user_bet_input)
        except ValueError:
            return

        actual_tc = int(round(self.deck.true_count()))
        correct_bet = self.spread.get_bet(actual_tc)

        self.tc_total += 1
        tc_ok = (user_tc == actual_tc)
        if tc_ok:
            self.tc_correct += 1

        self.bet_total += 1
        bet_ok = (user_bet == correct_bet)
        if bet_ok:
            self.bet_correct += 1

        parts = []
        if tc_ok:
            parts.append(f"TC: Correct ({actual_tc})")
        else:
            parts.append(f"TC: Actual {actual_tc}")

        if bet_ok:
            parts.append(f"Bet: Correct ({correct_bet}u)")
            self.txt_bet_feedback.color = arcade.color.GREEN
        else:
            parts.append(f"Bet: Should be {correct_bet}u")
            self.txt_bet_feedback.color = arcade.color.RED

        self.txt_bet_feedback.text = "  |  ".join(parts)
        self.state = 'bet_feedback'
        self.bet_feedback_timer = 0.0

    def _start_dealing(self):
        total = self.rules.num_decks * 52
        threshold = total * (1 - self.rules.penetration)
        if self.deck.num_remaining() < threshold:
            self.deck.shuffle()

        self.round_num += 1
        self.player_hand = Hand()
        self.dealer_hand = Hand()

        self.player_hand.add_card(self.deck.next_card())
        self.dealer_hand.add_card(self.deck.next_card())
        self.player_hand.add_card(self.deck.next_card())
        self.dealer_hand.add_card(self.deck.next_card())

        self._build_sprites()
        self._animate_deal()

    def _build_sprites(self):
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        for i, card in enumerate(self.dealer_hand.cards):
            if i == 1:
                tex = get_card_texture(Deck.get_back_image_path())
            else:
                tex = get_card_texture(card.get_image_path())
            s = arcade.Sprite(tex, scale=CARD_SCALE)
            s.center_x = self.CARDS_START_X + i * CARD_SPACING
            s.center_y = self.DEALER_Y
            self.dealer_sprites.append(s)

        for i, card in enumerate(self.player_hand.cards):
            tex = get_card_texture(card.get_image_path())
            s = arcade.Sprite(tex, scale=CARD_SCALE)
            s.center_x = self.CARDS_START_X + i * CARD_SPACING
            s.center_y = self.PLAYER_Y
            self.player_sprites.append(s)

    def _animate_deal(self):
        order = [
            (self.player_sprites, 0, self.PLAYER_Y),
            (self.dealer_sprites, 0, self.DEALER_Y),
            (self.player_sprites, 1, self.PLAYER_Y),
            (self.dealer_sprites, 1, self.DEALER_Y),
        ]
        for i, (slist, idx, y) in enumerate(order):
            sprite = slist[idx]
            target_x = self.CARDS_START_X + idx * CARD_SPACING
            self._queue_anim(sprite, target_x, y, delay=i * ANIM_STAGGER)

        self._start_anims(callback=self._on_deal_done)

    def _on_deal_done(self):
        if self.player_hand.is_blackjack():
            self._do_dealer_turn()
        else:
            self.state = 'playing'
            self._setup_playing_ui()

    # ------------------------------------------------------------------
    # Playing phase — user makes decisions, validated against basic strategy
    # ------------------------------------------------------------------
    def _setup_playing_ui(self):
        self.ui.clear()
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=10)

        hit_btn = make_button("Hit (H)", width=110, height=44)
        stand_btn = make_button("Stand (S)", width=110, height=44)
        hit_btn.on_click = lambda e: self._player_action('H')
        stand_btn.on_click = lambda e: self._player_action('S')
        h_box.add(hit_btn)
        h_box.add(stand_btn)

        hints = "H  Hit  |  S  Stand"

        if (self.rules.allow_double and self.player_hand.can_double()):
            dbl_btn = make_button("Double (D)", width=120, height=44)
            dbl_btn.on_click = lambda e: self._player_action('D')
            h_box.add(dbl_btn)
            hints += "  |  D  Double"

        if (self.rules.allow_surrender and len(self.player_hand.cards) == 2):
            surr_btn = make_button("Surrender (R)", width=140, height=44)
            surr_btn.on_click = lambda e: self._player_action('R')
            h_box.add(surr_btn)
            hints += "  |  R  Surrender"

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=h_box, anchor_x="center_x", anchor_y="bottom",
                    align_y=_ACTION_BAR_Y)
        self.ui.add(anchor)
        self.txt_key_hints.text = hints + "  |  Esc  Menu"

    def _player_action(self, action):
        if self.state != 'playing' or self._animating:
            return

        dealer_up = self.dealer_hand.cards[0]
        correct = lookup_action(self.rules, self.player_hand, dealer_up.rank)

        self.play_total += 1
        if action == correct:
            self.play_correct += 1
            self.txt_play_feedback.text = "Correct!"
            self.txt_play_feedback.color = arcade.color.GREEN
        else:
            cname = ACTION_NAMES.get(correct, correct)
            self.txt_play_feedback.text = f"Wrong — correct: {cname}"
            self.txt_play_feedback.color = arcade.color.RED

        self.play_feedback_timer = 0.0

        # Execute the action regardless (play continues)
        if action == 'H':
            self.player_hand.add_card(self.deck.next_card())
            self._add_player_sprite()
            self._start_anims(callback=self._after_player_action)
        elif action == 'D':
            self.player_hand.add_card(self.deck.next_card())
            self._add_player_sprite()
            self._start_anims(callback=self._do_dealer_turn)
        elif action == 'R':
            self._reveal_hole()
            self._show_result("Surrendered")
        else:  # Stand
            self._do_dealer_turn()

    def _after_player_action(self):
        if self.player_hand.is_bust():
            self._reveal_hole()
            self._show_result("Bust!")
        elif self.player_hand.value() == 21:
            self._do_dealer_turn()
        else:
            self.state = 'playing'
            self._setup_playing_ui()

    def _add_player_sprite(self):
        card = self.player_hand.cards[-1]
        idx = len(self.player_hand.cards) - 1
        tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SCALE)
        target_x = self.CARDS_START_X + idx * CARD_SPACING
        self.player_sprites.append(sprite)
        self._queue_anim(sprite, target_x, self.PLAYER_Y)

    # ------------------------------------------------------------------
    # Dealer turn
    # ------------------------------------------------------------------
    def _do_dealer_turn(self):
        self._reveal_hole()
        # Dealer draws
        hits_s17 = self.rules.dealer_hits_soft_17
        while True:
            val = self.dealer_hand.value()
            soft = self.dealer_hand.is_soft()
            if val < 17 or (hits_s17 and val == 17 and soft):
                card = self.deck.next_card()
                self.dealer_hand.add_card(card)
                idx = len(self.dealer_hand.cards) - 1
                tex = get_card_texture(card.get_image_path())
                sprite = arcade.Sprite(tex, scale=CARD_SCALE)
                target_x = self.CARDS_START_X + idx * CARD_SPACING
                sprite.center_x = target_x
                sprite.center_y = self.DEALER_Y
                self.dealer_sprites.append(sprite)
            else:
                break

        pv = self.player_hand.value()
        dv = self.dealer_hand.value()
        if self.player_hand.is_bust():
            msg = "Bust!"
        elif self.player_hand.is_blackjack() and not self.dealer_hand.is_blackjack():
            msg = "Blackjack!"
        elif self.dealer_hand.is_bust():
            msg = "Dealer Busts — You Win!"
        elif pv > dv:
            msg = "You Win!"
        elif pv < dv:
            msg = "Dealer Wins"
        else:
            msg = "Push"
        self._show_result(msg)

    def _reveal_hole(self):
        if len(self.dealer_sprites) >= 2:
            hole = self.dealer_hand.cards[1]
            tex = get_card_texture(hole.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            sprite.center_x = self.dealer_sprites[1].center_x
            sprite.center_y = self.dealer_sprites[1].center_y
            self.dealer_sprites[1] = sprite

    def _show_result(self, msg):
        self.result_msg = msg
        self.txt_result.text = msg
        if 'Win' in msg or 'Blackjack' in msg:
            self.txt_result.color = arcade.color.GREEN
        elif 'Bust' in msg or 'Dealer Wins' in msg:
            self.txt_result.color = arcade.color.RED
        else:
            self.txt_result.color = arcade.color.GOLD
        self.rounds_played += 1
        self.state = 'result'
        self.result_timer = 0.0
        self.ui.clear()
        self.txt_key_hints.text = "Enter  Next Hand  |  Esc  Menu"

    # ------------------------------------------------------------------
    # Input
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if self._animating:
            return

        if self.state == 'betting':
            if key == arcade.key.TAB:
                self._toggle_field()
            elif key == arcade.key.RETURN or key == arcade.key.ENTER:
                self._submit_betting()
            elif key == arcade.key.BACKSPACE:
                self._backspace()
            elif key == arcade.key.MINUS or key == arcade.key.NUM_SUBTRACT:
                self._type('-')
            elif arcade.key.KEY_0 <= key <= arcade.key.KEY_9:
                self._type(chr(key))
            elif arcade.key.NUM_0 <= key <= arcade.key.NUM_9:
                self._type(str(key - arcade.key.NUM_0))
            elif key == arcade.key.ESCAPE:
                self._go_home()

        elif self.state == 'bet_feedback':
            if key in (arcade.key.RETURN, arcade.key.ENTER, arcade.key.SPACE):
                self._start_dealing()
            elif key == arcade.key.ESCAPE:
                self._go_home()

        elif self.state == 'playing':
            if key == arcade.key.H:
                self._player_action('H')
            elif key == arcade.key.S:
                self._player_action('S')
            elif key == arcade.key.D:
                self._player_action('D')
            elif key == arcade.key.R:
                self._player_action('R')
            elif key == arcade.key.ESCAPE:
                self._go_home()

        elif self.state == 'result':
            if key in (arcade.key.RETURN, arcade.key.ENTER, arcade.key.SPACE):
                self._setup_betting_prompt()
            elif key == arcade.key.ESCAPE:
                self._go_home()

    def _go_home(self):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def _toggle_field(self):
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

    def _type(self, ch):
        if self.input_field == 'tc':
            if ch == '-' and self.user_tc_input:
                return
            self.user_tc_input += ch
            self.txt_input_tc.text = self.user_tc_input
        else:
            if ch == '-':
                return
            self.user_bet_input += ch
            self.txt_input_bet.text = self.user_bet_input

    def _backspace(self):
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
        self._tick_anims(delta_time)

        if self.state == 'bet_feedback':
            self.bet_feedback_timer += delta_time
            if self.bet_feedback_timer >= 2.0:
                self._start_dealing()

        if self.play_feedback_msg:
            self.play_feedback_timer += delta_time
            if self.play_feedback_timer >= 2.0:
                self.play_feedback_msg = ""
                self.txt_play_feedback.text = ""

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()

        # Shoe
        total = self.rules.num_decks * 52
        rem = self.deck.num_remaining()
        self.txt_shoe.text = f"Shoe: {rem}/{total}  (~{rem / 52:.1f}D)"
        self.txt_shoe.draw()

        # Scores
        bpct = (self.bet_correct / self.bet_total * 100) if self.bet_total > 0 else 0
        ppct = (self.play_correct / self.play_total * 100) if self.play_total > 0 else 0
        tpct = (self.tc_correct / self.tc_total * 100) if self.tc_total > 0 else 0
        self.txt_score.text = (
            f"Bets: {self.bet_correct}/{self.bet_total} ({bpct:.0f}%)  |  "
            f"Play: {self.play_correct}/{self.play_total} ({ppct:.0f}%)"
        )
        self.txt_score.draw()
        self.txt_score2.text = f"TC: {self.tc_correct}/{self.tc_total} ({tpct:.0f}%)  |  Rounds: {self.rounds_played}"
        self.txt_score2.draw()

        # Labels + cards
        self.txt_dealer_label.draw()
        self.txt_player_label.draw()
        self.dealer_sprites.draw()
        self.player_sprites.draw()

        # Hand values (when cards visible)
        if self.player_hand.cards and self.state not in ('betting', 'bet_feedback'):
            self.txt_player_value.text = f"Value: {self.player_hand.value()}"
            self.txt_player_value.draw()
        if self.dealer_hand.cards and self.state not in ('betting', 'bet_feedback'):
            if self.state == 'result':
                self.txt_dealer_showing.text = f"Value: {self.dealer_hand.value()}"
            elif self.dealer_hand.cards:
                up = self.dealer_hand.cards[0]
                show = "A" if up.rank == 'a' else str(up.value())
                self.txt_dealer_showing.text = f"Showing: {show}"
            self.txt_dealer_showing.draw()

        # Betting overlay
        if self.state in ('betting', 'bet_feedback'):
            arcade.draw_lrbt_rectangle_filled(
                SCREEN_WIDTH / 2 - 280, SCREEN_WIDTH / 2 + 280,
                SCREEN_HEIGHT / 2 - 105, SCREEN_HEIGHT / 2 + 80,
                (0, 0, 0, 200),
            )
            self.txt_prompt_tc.draw()
            self.txt_input_tc.draw()
            self.txt_prompt_bet.draw()
            self.txt_input_bet.draw()
            if self.state == 'bet_feedback':
                self.txt_bet_feedback.draw()

        # Play feedback
        if self.txt_play_feedback.text:
            self.txt_play_feedback.draw()

        # Result
        if self.state == 'result':
            self.txt_result.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
