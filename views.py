import arcade
import arcade.gui
from models import Game, Deck

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
        arcade.draw_text(
            "BLACKJACK",
            self.window.width / 2, self.window.height - 150,
            arcade.color.GOLD, font_size=64, anchor_x="center", bold=True,
        )
        arcade.draw_text(
            "Training Software",
            self.window.width / 2, self.window.height - 200,
            arcade.color.WHITE, font_size=22, anchor_x="center",
        )
        self.ui.draw()

    def _on_play(self, event):
        self.window.show_view(GameView())

    def _on_options(self, event):
        self.window.show_view(OptionsView())

    def _on_credits(self, event):
        self.window.show_view(CreditsView())

    def _on_exit(self, event):
        arcade.exit()


# ===========================================================================
# GAME VIEW
# ===========================================================================
class GameView(arcade.View):
    """Main blackjack game view."""

    # Layout constants
    DEALER_Y = 580
    PLAYER_Y = 280
    CARDS_START_X = 320

    def __init__(self):
        super().__init__()
        self.game = Game(num_decks=6, min_bet=10)
        self.ui = arcade.gui.UIManager()

        # State: 'betting', 'playing', 'dealer_turn', 'result'
        self.state = 'betting'
        self.current_bet = self.game.min_bet
        self.result_info = None
        self.result_message = ""

        # Card sprite lists
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # GUI containers for different states
        self._bet_widgets = None
        self._play_widgets = None
        self._result_widgets = None
        self._bet_label = None

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
        back_btn.on_click = lambda e: self.window.show_view(HomeView())
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def _setup_playing_ui(self):
        self._clear_ui()
        self.state = 'playing'

        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=15)
        hit_btn = make_button("Hit", width=120, height=50)
        stand_btn = make_button("Stand", width=120, height=50)
        double_btn = make_button("Double", width=120, height=50)

        hit_btn.on_click = self._on_hit
        stand_btn.on_click = self._on_stand
        double_btn.on_click = self._on_double

        h_box.add(hit_btn)
        h_box.add(stand_btn)
        if self.game.round and self.game.player.hand.can_double() and self.game.player.chips >= self.game.player.bets[0]:
            h_box.add(double_btn)

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
        }
        self.result_message = messages.get(result, "")
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

        # Draw table info bar at top
        arcade.draw_text(
            f"Chips: ${self.game.player.chips}",
            20, SCREEN_HEIGHT - 30,
            arcade.color.GOLD, font_size=18,
        )
        stats = self.game.get_stats()
        arcade.draw_text(
            f"Hands: {stats['hands_played']}  W: {stats['wins']}  L: {stats['losses']}  P: {stats['pushes']}",
            SCREEN_WIDTH - 420, SCREEN_HEIGHT - 30,
            arcade.color.WHITE, font_size=14,
        )

        if self.state == 'betting':
            arcade.draw_text(
                "Place Your Bet",
                SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100,
                arcade.color.WHITE, font_size=32, anchor_x="center", bold=True,
            )
        else:
            # Draw card labels
            arcade.draw_text("Dealer", 20, self.DEALER_Y + 30, arcade.color.WHITE, font_size=18)
            arcade.draw_text("Player", 20, self.PLAYER_Y + 30, arcade.color.WHITE, font_size=18)

            # Draw cards
            self.dealer_sprites.draw()
            self.player_sprites.draw()

            # Show hand values
            player_val = self.game.player.hands[0].value()
            arcade.draw_text(
                f"Value: {player_val}",
                20, self.PLAYER_Y - 40,
                arcade.color.GOLD, font_size=18,
            )

            if self.state in ('dealer_turn', 'result'):
                dealer_val = self.game.dealer.hands[0].value()
                arcade.draw_text(
                    f"Value: {dealer_val}",
                    20, self.DEALER_Y - 40,
                    arcade.color.GOLD, font_size=18,
                )
            else:
                # Show only the up card value
                if self.game.dealer.hands[0].cards:
                    up_val = self.game.dealer.hands[0].cards[0].value()
                    if self.game.dealer.hands[0].cards[0].rank == 'a':
                        arcade.draw_text(
                            "Showing: A",
                            20, self.DEALER_Y - 40,
                            arcade.color.GOLD, font_size=18,
                        )
                    else:
                        arcade.draw_text(
                            f"Showing: {up_val}",
                            20, self.DEALER_Y - 40,
                            arcade.color.GOLD, font_size=18,
                        )

            # Show current bet
            arcade.draw_text(
                f"Bet: ${self.game.player.bets[0]}",
                20, self.PLAYER_Y - 70,
                arcade.color.WHITE, font_size=16,
            )

        # Result message
        if self.state == 'result' and self.result_message:
            color = arcade.color.GOLD
            if 'Win' in self.result_message or 'BLACKJACK' in self.result_message:
                color = arcade.color.GREEN
            elif 'Bust' in self.result_message or 'Dealer Wins' in self.result_message:
                color = arcade.color.RED
            arcade.draw_text(
                self.result_message,
                SCREEN_WIDTH / 2, self.PLAYER_Y - 100,
                color, font_size=30, anchor_x="center", bold=True,
            )

        self.ui.draw()


# ===========================================================================
# OPTIONS VIEW
# ===========================================================================
class OptionsView(arcade.View):
    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        v_box = arcade.gui.UIBoxLayout(space_between=20)

        back_btn = make_button("Back to Menu")
        back_btn.on_click = lambda e: self.window.show_view(HomeView())
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def on_draw(self):
        self.clear()
        arcade.draw_text(
            "Options",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 150,
            arcade.color.GOLD, font_size=48, anchor_x="center", bold=True,
        )
        arcade.draw_text(
            "Coming soon...",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2,
            arcade.color.WHITE, font_size=22, anchor_x="center",
        )
        self.ui.draw()


# ===========================================================================
# CREDITS VIEW
# ===========================================================================
class CreditsView(arcade.View):
    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        v_box = arcade.gui.UIBoxLayout(space_between=20)

        back_btn = make_button("Back to Menu")
        back_btn.on_click = lambda e: self.window.show_view(HomeView())
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def on_draw(self):
        self.clear()
        arcade.draw_text(
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
        y = SCREEN_HEIGHT / 2 + 40
        for line in lines:
            arcade.draw_text(
                line, SCREEN_WIDTH / 2, y,
                arcade.color.WHITE, font_size=18, anchor_x="center",
            )
            y -= 30
        self.ui.draw()
