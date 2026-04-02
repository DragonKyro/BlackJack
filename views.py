import arcade
import arcade.gui
from models import Game, Deck, Rules

SCREEN_WIDTH = 1024
SCREEN_HEIGHT = 768
SCREEN_TITLE = "Blackjack Trainer"

FELT_GREEN = (35, 101, 51)
CARD_SCALE = 0.9
CARD_WIDTH = int(100 * CARD_SCALE)
CARD_HEIGHT = int(140 * CARD_SCALE)
CARD_SPACING = 90


# --- Texture Cache ---
_texture_cache = {}


def get_card_texture(path):
    if path not in _texture_cache:
        _texture_cache[path] = arcade.load_texture(path)
    return _texture_cache[path]


# --- Button Styling ---
BUTTON_STYLE = {
    "normal": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=arcade.color.DIM_GRAY,
        border=arcade.color.WHITE,
        border_width=2,
    ),
    "hover": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=arcade.color.GRAY,
        border=arcade.color.GOLD,
        border_width=2,
    ),
    "press": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=arcade.color.DARK_GRAY,
        border=arcade.color.GOLD,
        border_width=2,
    ),
}


def make_button(text, width=200, height=50):
    return arcade.gui.UIFlatButton(text=text, width=width, height=height, style=BUTTON_STYLE)


# ===========================================================================
# HOME VIEW
# ===========================================================================
class HomeView(arcade.View):
    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.title_text = arcade.Text(
            "BLACKJACK",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 150,
            arcade.color.GOLD, font_size=64, anchor_x="center", bold=True,
        )
        self.subtitle_text = arcade.Text(
            "Training Software",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 200,
            arcade.color.WHITE, font_size=22, anchor_x="center",
        )

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        v_box = arcade.gui.UIBoxLayout(space_between=20)

        play_btn = make_button("Play")
        options_btn = make_button("Options")
        credits_btn = make_button("Credits")
        exit_btn = make_button("Exit")

        play_btn.on_click = self._on_play
        options_btn.on_click = self._on_options
        credits_btn.on_click = self._on_credits
        exit_btn.on_click = self._on_exit

        v_box.add(play_btn)
        v_box.add(options_btn)
        v_box.add(credits_btn)
        v_box.add(exit_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-50)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def on_draw(self):
        self.clear()
        self.title_text.draw()
        self.subtitle_text.draw()
        self.ui.draw()

    def _on_play(self, event):
        self.window.show_view(RulesView())

    def _on_options(self, event):
        self.window.show_view(OptionsView())

    def _on_credits(self, event):
        self.window.show_view(CreditsView())

    def _on_exit(self, event):
        arcade.exit()


# ===========================================================================
# RULES VIEW
# ===========================================================================
TOGGLE_ON_STYLE = {
    "normal": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(40, 120, 40),
        border=arcade.color.GREEN,
        border_width=2,
    ),
    "hover": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(50, 140, 50),
        border=arcade.color.GOLD,
        border_width=2,
    ),
    "press": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(30, 100, 30),
        border=arcade.color.GOLD,
        border_width=2,
    ),
}

TOGGLE_OFF_STYLE = {
    "normal": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.LIGHT_GRAY,
        bg=(100, 40, 40),
        border=arcade.color.DARK_RED,
        border_width=2,
    ),
    "hover": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(120, 50, 50),
        border=arcade.color.GOLD,
        border_width=2,
    ),
    "press": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(80, 30, 30),
        border=arcade.color.GOLD,
        border_width=2,
    ),
}


class RulesView(arcade.View):
    """Pre-game rules configuration screen."""

    DECK_OPTIONS = [1, 2, 4, 6, 8]
    PENETRATION_OPTIONS = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90]
    BJ_PAYOUT_OPTIONS = [1.5, 1.2]
    MIN_BET_OPTIONS = [5, 10, 25, 50, 100]

    def __init__(self, rules=None):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = rules or Rules()
        self.txt_title = arcade.Text(
            "Table Rules",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60,
            arcade.color.GOLD, font_size=42, anchor_x="center", bold=True,
        )
        # Stores references to buttons so we can update their text/style
        self._toggle_buttons = {}
        self._cycle_buttons = {}

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._toggle_buttons.clear()
        self._cycle_buttons.clear()

        # Two-column grid of settings
        main_box = arcade.gui.UIBoxLayout(space_between=12)

        # --- Cycle options (label + cycle button) ---
        self._add_cycle_row(main_box, "Decks", "num_decks",
                            self.DECK_OPTIONS, str(self.rules.num_decks))
        self._add_cycle_row(main_box, "Penetration", "penetration",
                            self.PENETRATION_OPTIONS, self.rules.penetration_label())
        self._add_cycle_row(main_box, "Blackjack Pays", "blackjack_payout",
                            self.BJ_PAYOUT_OPTIONS, self.rules.blackjack_label())
        self._add_cycle_row(main_box, "Dealer on 17", "dealer_hits_soft_17",
                            [True, False],
                            self.rules.dealer_17_label())
        self._add_cycle_row(main_box, "Min Bet", "min_bet",
                            self.MIN_BET_OPTIONS, f"${self.rules.min_bet}")

        # --- Toggle options ---
        self._add_toggle_row(main_box, "Double Down", "allow_double", self.rules.allow_double)
        self._add_toggle_row(main_box, "Split", "allow_split", self.rules.allow_split)
        self._add_toggle_row(main_box, "Double After Split", "allow_double_after_split",
                             self.rules.allow_double_after_split)
        self._add_toggle_row(main_box, "Surrender", "allow_surrender", self.rules.allow_surrender)
        self._add_toggle_row(main_box, "Insurance", "allow_insurance", self.rules.allow_insurance)

        # --- Action buttons ---
        btn_row = arcade.gui.UIBoxLayout(vertical=False, space_between=20)
        start_btn = make_button("Start Game", width=200, height=50)
        start_btn.on_click = self._on_start
        back_btn = make_button("Back", width=140, height=50)
        back_btn.on_click = self._on_back_to_menu
        btn_row.add(back_btn)
        btn_row.add(start_btn)
        main_box.add(btn_row)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=main_box, anchor_x="center_x", anchor_y="center_y", align_y=-30)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    # --- Row builders ---
    def _add_toggle_row(self, parent, label_text, attr, current_value):
        row = arcade.gui.UIBoxLayout(vertical=False, space_between=10)
        lbl = arcade.gui.UILabel(
            text=label_text, width=220, height=36, font_size=16,
            text_color=arcade.color.WHITE, align="right",
        )
        btn_text = "ON" if current_value else "OFF"
        btn_style = TOGGLE_ON_STYLE if current_value else TOGGLE_OFF_STYLE
        btn = arcade.gui.UIFlatButton(text=btn_text, width=100, height=36, style=btn_style)
        self._toggle_buttons[attr] = btn

        def on_click(event, a=attr):
            val = not getattr(self.rules, a)
            setattr(self.rules, a, val)
            b = self._toggle_buttons[a]
            b.text = "ON" if val else "OFF"
            b.style = TOGGLE_ON_STYLE if val else TOGGLE_OFF_STYLE

        btn.on_click = on_click
        row.add(lbl)
        row.add(btn)
        parent.add(row)

    def _add_cycle_row(self, parent, label_text, attr, options, display_text):
        row = arcade.gui.UIBoxLayout(vertical=False, space_between=10)
        lbl = arcade.gui.UILabel(
            text=label_text, width=220, height=36, font_size=16,
            text_color=arcade.color.WHITE, align="right",
        )
        btn = make_button(display_text, width=100, height=36)
        self._cycle_buttons[attr] = (btn, options)

        def on_click(event, a=attr):
            b, opts = self._cycle_buttons[a]
            cur = getattr(self.rules, a)
            try:
                idx = opts.index(cur)
            except ValueError:
                idx = 0
            nxt = opts[(idx + 1) % len(opts)]
            setattr(self.rules, a, nxt)
            b.text = self._format_cycle_value(a, nxt)

        btn.on_click = on_click
        row.add(lbl)
        row.add(btn)
        parent.add(row)

    def _format_cycle_value(self, attr, value):
        if attr == "penetration":
            return f"{int(value * 100)}%"
        if attr == "blackjack_payout":
            return "3:2" if value == 1.5 else "6:5"
        if attr == "dealer_hits_soft_17":
            return "H17" if value else "S17"
        if attr == "min_bet":
            return f"${value}"
        return str(value)

    def _on_back_to_menu(self, event):
        self.window.show_view(HomeView())

    def _on_start(self, event):
        self.window.show_view(GameView(self.rules))

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.ui.draw()


# ===========================================================================
# GAME VIEW
# ===========================================================================
class GameView(arcade.View):
    """Main blackjack game view."""

    # Layout constants
    DEALER_Y = 580
    PLAYER_Y = 280
    CARDS_START_X = 320

    def __init__(self, rules=None):
        super().__init__()
        self.rules = rules or Rules()
        self.game = Game(rules=self.rules)
        self.ui = arcade.gui.UIManager()

        # State: 'betting', 'playing', 'dealer_turn', 'result'
        self.state = 'betting'
        self.current_bet = self.game.min_bet
        self.result_info = None
        self.result_message = ""

        # Card sprite lists
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # GUI containers
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
            SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100,
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
        self.txt_bet = arcade.Text(
            "", 20, self.PLAYER_Y - 70,
            arcade.color.WHITE, font_size=16,
        )
        self.txt_result = arcade.Text(
            "", SCREEN_WIDTH / 2, self.PLAYER_Y - 100,
            arcade.color.GOLD, font_size=30, anchor_x="center", bold=True,
        )

    # --- View lifecycle ---
    def on_show_view(self):
        self.ui.enable()
        self.window.background_color = FELT_GREEN
        self._setup_betting_ui()

    def on_hide_view(self):
        self.ui.disable()

    # --- UI setup helpers ---
    def _clear_ui(self):
        self.ui.clear()

    def _setup_betting_ui(self):
        self._clear_ui()
        self.state = 'betting'

        v_box = arcade.gui.UIBoxLayout(space_between=15)

        # Bet amount display
        self._bet_label = arcade.gui.UILabel(
            text=f"Bet: ${self.current_bet}",
            width=200, height=40, font_size=22,
            text_color=arcade.color.GOLD, align="center",
        )
        v_box.add(self._bet_label)

        # Bet adjustment buttons
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=10)
        minus_btn = make_button("-10", width=80, height=40)
        plus_btn = make_button("+10", width=80, height=40)
        minus50_btn = make_button("-50", width=80, height=40)
        plus50_btn = make_button("+50", width=80, height=40)

        minus_btn.on_click = lambda e: self._adjust_bet(-10)
        plus_btn.on_click = lambda e: self._adjust_bet(10)
        minus50_btn.on_click = lambda e: self._adjust_bet(-50)
        plus50_btn.on_click = lambda e: self._adjust_bet(50)

        h_box.add(minus50_btn)
        h_box.add(minus_btn)
        h_box.add(plus_btn)
        h_box.add(plus50_btn)
        v_box.add(h_box)

        # Deal button
        deal_btn = make_button("Deal", width=200, height=50)
        deal_btn.on_click = self._on_deal
        v_box.add(deal_btn)

        # Back button
        back_btn = make_button("Back to Menu", width=200, height=40)
        back_btn.on_click = self._on_back_to_menu
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def _setup_playing_ui(self):
        self._clear_ui()
        self.state = 'playing'

        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=15)
        hit_btn = make_button("Hit", width=110, height=50)
        stand_btn = make_button("Stand", width=110, height=50)

        hit_btn.on_click = self._on_hit
        stand_btn.on_click = self._on_stand

        h_box.add(hit_btn)
        h_box.add(stand_btn)

        rnd = self.game.round
        if rnd:
            can_dbl = (self.rules.allow_double
                       and self.game.player.hand.can_double()
                       and self.game.player.chips >= self.game.player.bets[0])
            if can_dbl:
                double_btn = make_button("Double", width=110, height=50)
                double_btn.on_click = self._on_double
                h_box.add(double_btn)

            can_surr = (self.rules.allow_surrender
                        and len(self.game.player.hand.cards) == 2)
            if can_surr:
                surr_btn = make_button("Surrender", width=130, height=50)
                surr_btn.on_click = self._on_surrender
                h_box.add(surr_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=h_box, anchor_x="center_x", anchor_y="bottom", align_y=30)
        self.ui.add(anchor)

    def _setup_result_ui(self):
        self._clear_ui()
        self.state = 'result'

        v_box = arcade.gui.UIBoxLayout(space_between=15)

        next_btn = make_button("Next Hand", width=200, height=50)
        next_btn.on_click = self._on_next_hand
        v_box.add(next_btn)

        menu_btn = make_button("Back to Menu", width=200, height=40)
        menu_btn.on_click = lambda e: self.window.show_view(HomeView())
        v_box.add(menu_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="bottom", align_y=30)
        self.ui.add(anchor)

    # --- Event handlers ---
    def _on_back_to_menu(self, event):
        self.window.show_view(HomeView())

    def _adjust_bet(self, amount):
        self.current_bet = max(self.game.min_bet, min(self.current_bet + amount, self.game.player.chips))
        if self._bet_label:
            self._bet_label.text = f"Bet: ${self.current_bet}"

    def _on_deal(self, event):
        if self.game.player.chips < self.current_bet:
            self.current_bet = max(self.game.min_bet, self.game.player.chips)
        if self.game.player.chips < self.game.min_bet:
            return  # Can't play with no chips

        self.game.start_round(self.current_bet)
        self._build_card_sprites(hide_dealer_hole=True)

        # Check for instant blackjack
        if self.game.player.hand.is_blackjack():
            self._do_dealer_turn()
            return

        self._setup_playing_ui()

    def _on_hit(self, event):
        self.game.round.player_hit()
        self._build_card_sprites(hide_dealer_hole=True)

        if self.game.round.phase == 'result':
            # Player busted
            self._build_card_sprites(hide_dealer_hole=False)
            self._finish_round()
        elif self.game.player.hand.can_double():
            pass  # Keep current UI
        else:
            # Rebuild UI without double button
            self._setup_playing_ui()

    def _on_stand(self, event):
        self._do_dealer_turn()

    def _on_double(self, event):
        self.game.round.player_double()
        if self.game.round.phase == 'result':
            self._build_card_sprites(hide_dealer_hole=False)
            self._finish_round()
        else:
            self._do_dealer_turn()

    def _on_surrender(self, event):
        self.game.round.player_surrender()
        self._build_card_sprites(hide_dealer_hole=False)
        self._finish_round()

    def _do_dealer_turn(self):
        self.game.round.dealer_play()
        self._build_card_sprites(hide_dealer_hole=False)
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

        # Update result text color
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
        self.result_info = None
        self.result_message = ""
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        if self.game.player.chips < self.game.min_bet:
            # Out of chips — reset
            self.game.player.chips = 1000
        self._setup_betting_ui()

    # --- Card sprite building ---
    def _build_card_sprites(self, hide_dealer_hole=True):
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # Dealer cards
        for i, card in enumerate(self.game.dealer.hands[0].cards):
            if i == 1 and hide_dealer_hole:
                tex = get_card_texture(Deck.get_back_image_path())
            else:
                tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            sprite.center_x = self.CARDS_START_X + i * CARD_SPACING
            sprite.center_y = self.DEALER_Y
            self.dealer_sprites.append(sprite)

        # Player cards
        for i, card in enumerate(self.game.player.hands[0].cards):
            tex = get_card_texture(card.get_image_path())
            sprite = arcade.Sprite(tex, scale=CARD_SCALE)
            sprite.center_x = self.CARDS_START_X + i * CARD_SPACING
            sprite.center_y = self.PLAYER_Y
            self.player_sprites.append(sprite)

    # --- Drawing ---
    def on_draw(self):
        self.clear()

        # Update and draw top info bar
        self.txt_chips.text = f"Chips: ${self.game.player.chips}"
        self.txt_chips.draw()

        stats = self.game.get_stats()
        self.txt_stats.text = f"Hands: {stats['hands_played']}  W: {stats['wins']}  L: {stats['losses']}  P: {stats['pushes']}"
        self.txt_stats.draw()

        if self.state == 'betting':
            self.txt_place_bet.draw()
        else:
            # Card labels
            self.txt_dealer_label.draw()
            self.txt_player_label.draw()

            # Draw cards
            self.dealer_sprites.draw()
            self.player_sprites.draw()

            # Player hand value
            self.txt_player_value.text = f"Value: {self.game.player.hands[0].value()}"
            self.txt_player_value.draw()

            # Dealer value / showing
            if self.state in ('dealer_turn', 'result'):
                self.txt_dealer_value.text = f"Value: {self.game.dealer.hands[0].value()}"
            else:
                if self.game.dealer.hands[0].cards:
                    up_card = self.game.dealer.hands[0].cards[0]
                    if up_card.rank == 'a':
                        self.txt_dealer_value.text = "Showing: A"
                    else:
                        self.txt_dealer_value.text = f"Showing: {up_card.value()}"
            self.txt_dealer_value.draw()

            # Current bet
            self.txt_bet.text = f"Bet: ${self.game.player.bets[0]}"
            self.txt_bet.draw()

        # Result message
        if self.state == 'result' and self.result_message:
            self.txt_result.text = self.result_message
            self.txt_result.draw()

        self.ui.draw()


# ===========================================================================
# OPTIONS VIEW
# ===========================================================================
class OptionsView(arcade.View):
    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.txt_title = arcade.Text(
            "Options",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 150,
            arcade.color.GOLD, font_size=48, anchor_x="center", bold=True,
        )
        self.txt_coming_soon = arcade.Text(
            "Coming soon...",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2,
            arcade.color.WHITE, font_size=22, anchor_x="center",
        )

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        v_box = arcade.gui.UIBoxLayout(space_between=20)

        back_btn = make_button("Back to Menu")
        back_btn.on_click = self._on_back_to_menu
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def _on_back_to_menu(self, event):
        self.window.show_view(HomeView())

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_coming_soon.draw()
        self.ui.draw()


# ===========================================================================
# CREDITS VIEW
# ===========================================================================
class CreditsView(arcade.View):
    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.txt_title = arcade.Text(
            "Credits",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 150,
            arcade.color.GOLD, font_size=48, anchor_x="center", bold=True,
        )
        lines = [
            "Blackjack Training Software",
            "",
            "Developed by Kyle Lui",
            "",
            "Card assets: Standard 52-card deck sprites",
        ]
        self.txt_lines = []
        y = SCREEN_HEIGHT / 2 + 40
        for line in lines:
            self.txt_lines.append(arcade.Text(
                line, SCREEN_WIDTH / 2, y,
                arcade.color.WHITE, font_size=18, anchor_x="center",
            ))
            y -= 30

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        v_box = arcade.gui.UIBoxLayout(space_between=20)

        back_btn = make_button("Back to Menu")
        back_btn.on_click = self._on_back_to_menu
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def _on_back_to_menu(self, event):
        self.window.show_view(HomeView())

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        for txt in self.txt_lines:
            txt.draw()
        self.ui.draw()
