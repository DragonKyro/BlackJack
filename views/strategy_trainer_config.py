import arcade
import arcade.gui
from models import Rules
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    TOGGLE_ON_STYLE, TOGGLE_OFF_STYLE, make_button,
)


class StrategyTrainerConfigView(arcade.View):
    """Select rules before starting the strategy trainer."""

    DECK_OPTIONS = [1, 2, 4, 6, 8]
    BJ_PAYOUT_OPTIONS = [1.5, 1.2]

    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = Rules()
        self.txt_title = arcade.Text(
            "Strategy Trainer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50,
            arcade.color.GOLD, font_size=36, anchor_x="center", bold=True,
        )
        self.txt_subtitle = arcade.Text(
            "Configure table rules for practice",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 82,
            (180, 180, 180), font_size=14, anchor_x="center",
        )
        self._toggle_buttons = {}
        self._cycle_buttons = {}

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._toggle_buttons.clear()
        self._cycle_buttons.clear()

        main_box = arcade.gui.UIBoxLayout(space_between=12)

        self._add_cycle_row(main_box, "Decks", "num_decks",
                            self.DECK_OPTIONS, str(self.rules.num_decks))
        self._add_cycle_row(main_box, "Dealer on 17", "dealer_hits_soft_17",
                            [True, False], self.rules.dealer_17_label())
        self._add_cycle_row(main_box, "Blackjack Pays", "blackjack_payout",
                            self.BJ_PAYOUT_OPTIONS, self.rules.blackjack_label())

        self._add_toggle_row(main_box, "Double Down", "allow_double", self.rules.allow_double)
        self._add_toggle_row(main_box, "Split", "allow_split", self.rules.allow_split)
        self._add_toggle_row(main_box, "Double After Split", "allow_double_after_split",
                             self.rules.allow_double_after_split)
        self._add_toggle_row(main_box, "Surrender", "allow_surrender", self.rules.allow_surrender)

        btn_row = arcade.gui.UIBoxLayout(vertical=False, space_between=20)
        back_btn = make_button("Back", width=140, height=50)
        back_btn.on_click = self._on_back
        start_btn = make_button("Start Training", width=200, height=50)
        start_btn.on_click = self._on_start
        btn_row.add(back_btn)
        btn_row.add(start_btn)
        main_box.add(btn_row)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=main_box, anchor_x="center_x", anchor_y="center_y", align_y=-40)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    # --- Row builders (same pattern as RulesView) ---
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
        if attr == "blackjack_payout":
            return "3:2" if value == 1.5 else "6:5"
        if attr == "dealer_hits_soft_17":
            return "H17" if value else "S17"
        return str(value)

    def _on_back(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def _on_start(self, event):
        from views.strategy_trainer import StrategyTrainerView
        self.window.show_view(StrategyTrainerView(rules=self.rules))

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_subtitle.draw()
        self.ui.draw()
