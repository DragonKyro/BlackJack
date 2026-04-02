import arcade
import arcade.gui
from models import Rules
from bet_spread import BetSpread
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    TOGGLE_ON_STYLE, TOGGLE_OFF_STYLE, make_button, make_cycle_row,
)


class BetTrainerConfigView(arcade.View):
    """Configure rules and bet spread before starting the bet trainer."""

    DECK_OPTIONS = [1, 2, 4, 6, 8]
    PENETRATION_OPTIONS = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90]
    SEAT_OPTIONS = [1, 2, 3, 4, 5]
    SPEED_OPTIONS = [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0]
    SPREAD_OPTIONS = ['1-12', '1-8', '1-4', 'Flat']

    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = Rules()
        self.num_seats = 3
        self.deal_speed = 0.8
        self.spread_name = '1-12'
        self._toggle_buttons = {}
        self._cycle_buttons = {}

        self.txt_title = arcade.Text(
            "Bet Trainer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50,
            arcade.color.GOLD, font_size=36, anchor_x="center", bold=True,
        )
        self.txt_subtitle = arcade.Text(
            "Practice counting + bet sizing — hands play automatically",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 82,
            (180, 180, 180), font_size=13, anchor_x="center",
        )

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._toggle_buttons.clear()
        self._cycle_buttons.clear()

        main_box = arcade.gui.UIBoxLayout(space_between=12)

        self._add_cycle_row(main_box, "Decks", "num_decks",
                            self.DECK_OPTIONS, str(self.rules.num_decks), target='rules')
        self._add_cycle_row(main_box, "Penetration", "penetration",
                            self.PENETRATION_OPTIONS, self.rules.penetration_label(), target='rules')
        self._add_cycle_row(main_box, "Dealer on 17", "dealer_hits_soft_17",
                            [True, False], self.rules.dealer_17_label(), target='rules')
        self._add_cycle_row(main_box, "Seats", "num_seats",
                            self.SEAT_OPTIONS, str(self.num_seats), target='self')
        self._add_cycle_row(main_box, "Deal Speed", "deal_speed",
                            self.SPEED_OPTIONS, f"{self.deal_speed:.1f}s", target='self')
        self._add_cycle_row(main_box, "Bet Spread", "spread_name",
                            self.SPREAD_OPTIONS, self.spread_name, target='self')

        self._add_toggle_row(main_box, "Surrender", "allow_surrender",
                             self.rules.allow_surrender)

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

    def _add_toggle_row(self, parent, label_text, attr, current_value):
        row = arcade.gui.UIBoxLayout(vertical=False, space_between=6)
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

    def _add_cycle_row(self, parent, label_text, attr, options, display_text, target='rules'):
        def _step(delta, a=attr, t=target):
            def handler(event):
                b, opts = self._cycle_buttons[a]
                obj = self.rules if t == 'rules' else self
                cur = getattr(obj, a)
                try:
                    idx = opts.index(cur)
                except ValueError:
                    idx = 0
                nxt = opts[(idx + delta) % len(opts)]
                setattr(obj, a, nxt)
                b.text = self._format_value(a, nxt)
            return handler

        row, val_btn = make_cycle_row(
            label_text, display_text,
            on_prev=_step(-1), on_next=_step(1),
        )
        self._cycle_buttons[attr] = (val_btn, options)
        parent.add(row)

    def _format_value(self, attr, value):
        if attr == 'penetration':
            return f"{int(value * 100)}%"
        if attr == 'dealer_hits_soft_17':
            return "H17" if value else "S17"
        if attr == 'deal_speed':
            return f"{value:.1f}s"
        return str(value)

    def _build_spread(self):
        if self.spread_name == '1-12':
            return BetSpread(spread={
                tc: (0 if tc <= -3 else 1 if tc <= 1 else
                     2 if tc == 2 else 4 if tc == 3 else
                     8 if tc == 4 else 12)
                for tc in range(-7, 11)
            })
        elif self.spread_name == '1-8':
            return BetSpread(spread={
                tc: (0 if tc <= -3 else 1 if tc <= 1 else
                     2 if tc == 2 else 4 if tc == 3 else
                     6 if tc == 4 else 8)
                for tc in range(-7, 11)
            })
        elif self.spread_name == '1-4':
            return BetSpread(spread={
                tc: (0 if tc <= -3 else 1 if tc <= 1 else
                     2 if tc == 2 else 3 if tc == 3 else 4)
                for tc in range(-7, 11)
            })
        else:  # Flat
            return BetSpread(spread={tc: 1 for tc in range(-7, 11)})

    def _on_back(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def _on_start(self, event):
        from views.bet_trainer import BetTrainerView
        self.window.show_view(BetTrainerView(
            rules=self.rules,
            spread=self._build_spread(),
            num_seats=self.num_seats,
            deal_speed=self.deal_speed,
        ))

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_subtitle.draw()
        self.ui.draw()
