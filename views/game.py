import arcade
import arcade.gui
from models import Game, Deck, Rules
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    CARD_SCALE, CARD_SPACING, get_card_texture, make_button,
)

# Animation constants
SHOE_X = SCREEN_WIDTH - 100
SHOE_Y = SCREEN_HEIGHT - 80
ANIM_DURATION = 0.22
ANIM_STAGGER = 0.15

# Bottom bar position — shared by ALL game states for consistency
_ACTION_BAR_Y = 50


class _CardAnim:
    """A single card slide animation."""
    __slots__ = ('sprite', 'start_x', 'start_y', 'end_x', 'end_y',
                 'duration', 'delay', 'done')

    def __init__(self, sprite, end_x, end_y, delay=0.0, duration=ANIM_DURATION):
        self.sprite = sprite
        self.start_x = SHOE_X
        self.start_y = SHOE_Y
        self.end_x = end_x
        self.end_y = end_y
        self.duration = duration
        self.delay = delay
        self.done = False


class GameView(arcade.View):
    """Main blackjack game view."""

    # Layout constants
    DEALER_Y = 580
    PLAYER_Y = 300
    CARDS_START_X = 320

    def __init__(self, rules=None):
        super().__init__()
        self.rules = rules or Rules()
        self.game = Game(rules=self.rules)
        self.ui = arcade.gui.UIManager()

        # State: 'betting', 'playing', 'animating', 'result'
        self.state = 'betting'
        self.current_bet = self.game.min_bet
        self.result_info = None
        self.result_message = ""

        # Card sprite lists
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # Animation state
        self._animations = []
        self._anim_time = 0.0
        self._anim_callback = None

        # GUI reference
        self._bet_label = None

        # --- Pre-built Text objects ---
        self.txt_chips = arcade.Text(
            "", 20, SCREEN_HEIGHT - 30,
            arcade.color.GOLD, font_size=18,
        )
        self.txt_stats = arcade.Text(
            "", SCREEN_WIDTH - 420, SCREEN_HEIGHT - 30,
            arcade.color.WHITE, font_size=14,
        )
        self.txt_place_bet = arcade.Text(
            "Place Your Bet",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 60,
            arcade.color.WHITE, font_size=32, anchor_x="center", bold=True,
        )
        self.txt_dealer_label = arcade.Text(
            "Dealer", 20, self.DEALER_Y + 30,
            arcade.color.WHITE, font_size=18,
        )
        self.txt_player_label = arcade.Text(
            "Player", 20, self.PLAYER_Y + 30,
            arcade.color.WHITE, font_size=18,
        )
        self.txt_player_value = arcade.Text(
            "", 20, self.PLAYER_Y - 40,
            arcade.color.GOLD, font_size=18,
        )
        self.txt_dealer_value = arcade.Text(
            "", 20, self.DEALER_Y - 40,
            arcade.color.GOLD, font_size=18,
        )
        self.txt_bet_display = arcade.Text(
            "", 20, self.PLAYER_Y - 70,
            arcade.color.WHITE, font_size=16,
        )
        self.txt_result = arcade.Text(
            "", SCREEN_WIDTH / 2, self.PLAYER_Y - 100,
            arcade.color.GOLD, font_size=30, anchor_x="center", bold=True,
        )
        self.txt_key_hints = arcade.Text(
            "", SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

    # ------------------------------------------------------------------
    # View lifecycle
    # ------------------------------------------------------------------
    def on_show_view(self):
        self.ui.enable()
        self.window.background_color = FELT_GREEN
        self._setup_betting_ui()

    def on_hide_view(self):
        self.ui.disable()

    # ------------------------------------------------------------------
    # Animation engine
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
        self._clear_ui()

    def on_update(self, delta_time):
        if not self._animations:
            return
        self._anim_time += delta_time
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
            ease = 1 - (1 - t) ** 2  # ease-out quadratic
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
    # UI setup — all action bars anchored at the same bottom position
    # ------------------------------------------------------------------
    def _clear_ui(self):
        self.ui.clear()

    def _anchor_bottom(self, widget):
        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=widget, anchor_x="center_x", anchor_y="bottom",
                    align_y=_ACTION_BAR_Y)
        self.ui.add(anchor)

    def _setup_betting_ui(self):
        self._clear_ui()
        self.state = 'betting'

        v_box = arcade.gui.UIBoxLayout(space_between=10)

        self._bet_label = arcade.gui.UILabel(
            text=f"${self.current_bet}",
            width=80, height=36, font_size=20,
            text_color=arcade.color.GOLD, align="center",
        )

        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=8)
        minus50 = make_button("-50", width=70, height=44)
        minus10 = make_button("-10", width=70, height=44)
        plus10 = make_button("+10", width=70, height=44)
        plus50 = make_button("+50", width=70, height=44)
        deal_btn = make_button("Deal (Enter)", width=160, height=44)

        minus50.on_click = lambda e: self._adjust_bet(-50)
        minus10.on_click = lambda e: self._adjust_bet(-10)
        plus10.on_click = lambda e: self._adjust_bet(10)
        plus50.on_click = lambda e: self._adjust_bet(50)
        deal_btn.on_click = self._on_deal

        h_box.add(minus50)
        h_box.add(minus10)
        h_box.add(self._bet_label)
        h_box.add(plus10)
        h_box.add(plus50)
        h_box.add(deal_btn)

        v_box.add(h_box)
        self._anchor_bottom(v_box)
        self.txt_key_hints.text = (
            "\u2190\u2192  Adjust \u00b110  |  \u2191\u2193  Adjust \u00b150  "
            "|  Enter  Deal  |  T  Strategy  |  Esc  Menu"
        )

    def _setup_playing_ui(self):
        self._clear_ui()
        self.state = 'playing'

        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=12)
        hit_btn = make_button("Hit (H)", width=120, height=44)
        stand_btn = make_button("Stand (S)", width=120, height=44)
        hit_btn.on_click = self._on_hit
        stand_btn.on_click = self._on_stand
        h_box.add(hit_btn)
        h_box.add(stand_btn)

        rnd = self.game.round
        hints = "H  Hit  |  S  Stand"
        if rnd:
            can_dbl = (self.rules.allow_double
                       and self.game.player.hand.can_double()
                       and self.game.player.chips >= self.game.player.bets[0])
            if can_dbl:
                dbl_btn = make_button("Double (D)", width=130, height=44)
                dbl_btn.on_click = self._on_double
                h_box.add(dbl_btn)
                hints += "  |  D  Double"

            can_surr = (self.rules.allow_surrender
                        and len(self.game.player.hand.cards) == 2)
            if can_surr:
                surr_btn = make_button("Surrender (R)", width=150, height=44)
                surr_btn.on_click = self._on_surrender
                h_box.add(surr_btn)
                hints += "  |  R  Surrender"

        self._anchor_bottom(h_box)
        self.txt_key_hints.text = hints + "  |  T  Strategy  |  Esc  Menu"

    def _setup_result_ui(self):
        self._clear_ui()
        self.state = 'result'

        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=15)
        next_btn = make_button("Next Hand (Enter)", width=220, height=44)
        menu_btn = make_button("Menu (Esc)", width=140, height=44)
        next_btn.on_click = self._on_next_hand
        menu_btn.on_click = self._on_back_to_menu
        h_box.add(next_btn)
        h_box.add(menu_btn)

        self._anchor_bottom(h_box)
        self.txt_key_hints.text = "Enter  Next Hand  |  T  Strategy  |  Esc  Menu"

    # ------------------------------------------------------------------
    # Keyboard shortcuts
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if self._animating:
            return

        # T for strategy table — available in all non-animating states
        if key == arcade.key.T:
            from views.strategy import StrategyView
            self.window.show_view(StrategyView(rules=self.rules, return_view=self))
            return

        if self.state == 'betting':
            if key == arcade.key.RETURN or key == arcade.key.ENTER:
                self._on_deal(None)
            elif key == arcade.key.LEFT:
                self._adjust_bet(-10)
            elif key == arcade.key.RIGHT:
                self._adjust_bet(10)
            elif key == arcade.key.DOWN:
                self._adjust_bet(-50)
            elif key == arcade.key.UP:
                self._adjust_bet(50)
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'playing':
            if key == arcade.key.H:
                self._on_hit(None)
            elif key == arcade.key.S:
                self._on_stand(None)
            elif key == arcade.key.D:
                self._on_double(None)
            elif key == arcade.key.R:
                self._on_surrender(None)
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

        elif self.state == 'result':
            if key in (arcade.key.RETURN, arcade.key.ENTER, arcade.key.SPACE):
                self._on_next_hand(None)
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())

    # ------------------------------------------------------------------
    # Event handlers
    # ------------------------------------------------------------------
    def _on_back_to_menu(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def _adjust_bet(self, amount):
        self.current_bet = max(
            self.game.min_bet,
            min(self.current_bet + amount, self.game.player.chips),
        )
        if self._bet_label:
            self._bet_label.text = f"${self.current_bet}"

    def _on_deal(self, event):
        if self._animating:
            return
        if self.game.player.chips < self.current_bet:
            self.current_bet = max(self.game.min_bet, self.game.player.chips)
        if self.game.player.chips < self.game.min_bet:
            return

        self.game.start_round(self.current_bet)
        self._build_card_sprites(hide_dealer_hole=True)
        self._animate_initial_deal()

    def _on_hit(self, event):
        if self._animating:
            return
        rnd = self.game.round
        if not rnd or rnd.phase != 'playing':
            return
        rnd.player_hit()
        self._add_player_card_sprite()

        def after_hit():
            if rnd.phase == 'result':
                self._reveal_dealer_hole()
                self._finish_round()
            else:
                self._setup_playing_ui()

        self._start_anims(after_hit)

    def _on_stand(self, event):
        if self._animating:
            return
        self._do_dealer_turn_animated()

    def _on_double(self, event):
        if self._animating:
            return
        rnd = self.game.round
        if not rnd or not self.rules.allow_double:
            return
        if not self.game.player.hand.can_double():
            return
        if self.game.player.chips < self.game.player.bets[0]:
            return
        rnd.player_double()
        self._add_player_card_sprite()

        def after_double():
            if rnd.phase == 'result':
                self._reveal_dealer_hole()
                self._finish_round()
            else:
                self._do_dealer_turn_animated()

        self._start_anims(after_double)

    def _on_surrender(self, event):
        if self._animating:
            return
        rnd = self.game.round
        if not rnd or not self.rules.allow_surrender:
            return
        if len(self.game.player.hand.cards) != 2:
            return
        rnd.player_surrender()
        self._reveal_dealer_hole()
        self._finish_round()

    def _do_dealer_turn_animated(self):
        self.game.round.dealer_play()
        self._reveal_dealer_hole()
        num_dealer_cards = len(self.game.dealer.hands[0].cards)
        delay = 0.0
        for i in range(2, num_dealer_cards):
            card = self.game.dealer.hands[0].cards[i]
            tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            target_x = self.CARDS_START_X + i * CARD_SPACING
            target_y = self.DEALER_Y
            self.dealer_sprites.append(sprite)
            self._queue_anim(sprite, target_x, target_y, delay)
            delay += ANIM_STAGGER

        if self._animations:
            self._start_anims(self._finish_round)
        else:
            self._finish_round()

    def _finish_round(self):
        self.result_info = self.game.end_round()
        result = self.result_info['result']
        payout = self.result_info['payout']
        bet = self.result_info['bet']

        messages = {
            'blackjack': f"BLACKJACK! +${payout - bet}",
            'win': f"You Win! +${payout - bet}",
            'lose': f"Dealer Wins. -${bet}",
            'bust': f"Bust! -${bet}",
            'push': "Push - Bet Returned",
            'surrender': f"Surrendered. -${bet - payout}",
        }
        self.result_message = messages.get(result, "")

        if 'Win' in self.result_message or 'BLACKJACK' in self.result_message:
            self.txt_result.color = arcade.color.GREEN
        elif 'Bust' in self.result_message or 'Dealer Wins' in self.result_message:
            self.txt_result.color = arcade.color.RED
        elif 'Surrendered' in self.result_message:
            self.txt_result.color = arcade.color.YELLOW
        else:
            self.txt_result.color = arcade.color.GOLD

        self._setup_result_ui()

    def _on_next_hand(self, event):
        if self._animating:
            return
        self.result_info = None
        self.result_message = ""
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        if self.game.player.chips < self.game.min_bet:
            self.game.player.chips = 1000
        self._setup_betting_ui()

    # ------------------------------------------------------------------
    # Card sprite helpers
    # ------------------------------------------------------------------
    def _build_card_sprites(self, hide_dealer_hole=True):
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        for i, card in enumerate(self.game.dealer.hands[0].cards):
            if i == 1 and hide_dealer_hole:
                tex = get_card_texture(Deck.get_back_image_path())
            else:
                tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            sprite.center_x = self.CARDS_START_X + i * CARD_SPACING
            sprite.center_y = self.DEALER_Y
            self.dealer_sprites.append(sprite)

        for i, card in enumerate(self.game.player.hands[0].cards):
            tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            sprite.center_x = self.CARDS_START_X + i * CARD_SPACING
            sprite.center_y = self.PLAYER_Y
            self.player_sprites.append(sprite)

    def _add_player_card_sprite(self):
        card = self.game.player.hands[0].cards[-1]
        idx = len(self.game.player.hands[0].cards) - 1
        tex = get_card_texture(card.get_image_path())
        sprite = arcade.Sprite(tex, scale=CARD_SCALE)
        target_x = self.CARDS_START_X + idx * CARD_SPACING
        target_y = self.PLAYER_Y
        self.player_sprites.append(sprite)
        self._queue_anim(sprite, target_x, target_y)

    def _reveal_dealer_hole(self):
        if len(self.dealer_sprites) >= 2:
            hole_card = self.game.dealer.hands[0].cards[1]
            tex = get_card_texture(hole_card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            sprite.center_x = self.dealer_sprites[1].center_x
            sprite.center_y = self.dealer_sprites[1].center_y
            self.dealer_sprites[1] = sprite

    def _animate_initial_deal(self):
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

        def after_deal():
            if self.game.player.hand.is_blackjack():
                self._do_dealer_turn_animated()
            else:
                self._setup_playing_ui()

        self._start_anims(after_deal)

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()

        self.txt_chips.text = f"Chips: ${self.game.player.chips}"
        self.txt_chips.draw()
        stats = self.game.get_stats()
        self.txt_stats.text = (
            f"Hands: {stats['hands_played']}  W: {stats['wins']}  "
            f"L: {stats['losses']}  P: {stats['pushes']}"
        )
        self.txt_stats.draw()

        self.txt_dealer_label.draw()
        self.txt_player_label.draw()
        self.dealer_sprites.draw()
        self.player_sprites.draw()

        if self.state == 'betting':
            self.txt_place_bet.draw()

        if self.game.player.hands[0].cards:
            self.txt_player_value.text = f"Value: {self.game.player.hands[0].value()}"
            self.txt_player_value.draw()

        if self.game.dealer.hands[0].cards:
            if self.state == 'result':
                self.txt_dealer_value.text = f"Value: {self.game.dealer.hands[0].value()}"
            elif self.state in ('animating', 'playing'):
                up_card = self.game.dealer.hands[0].cards[0]
                show = "A" if up_card.rank == 'a' else str(up_card.value())
                self.txt_dealer_value.text = f"Showing: {show}"
            else:
                self.txt_dealer_value.text = ""
            if self.txt_dealer_value.text:
                self.txt_dealer_value.draw()

        if self.game.player.bets[0] > 0:
            self.txt_bet_display.text = f"Bet: ${self.game.player.bets[0]}"
            self.txt_bet_display.draw()

        if self.state == 'result' and self.result_message:
            self.txt_result.text = self.result_message
            self.txt_result.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
