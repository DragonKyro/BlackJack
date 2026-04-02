import arcade
import arcade.gui
from views.common import SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN, make_button


class CountingTrainerConfigView(arcade.View):
    """Configure settings before starting the counting trainer."""

    DECK_OPTIONS = [1, 2, 4, 6, 8]
    SEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7]
    SPEED_OPTIONS = [0.3, 0.5, 0.8, 1.0, 1.5, 2.0]
    POLL_OPTIONS = [5, 10, 15, 20, 30, 52]

    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.num_decks = 6
        self.num_seats = 5
        self.deal_speed = 1.0
        self.poll_freq = 10

        self.txt_title = arcade.Text(
            "Counting Trainer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50,
            arcade.color.GOLD, font_size=36, anchor_x="center", bold=True,
        )
        self.txt_subtitle = arcade.Text(
            "Practice Hi-Lo card counting",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 82,
            (180, 180, 180), font_size=14, anchor_x="center",
        )
        self._cycle_buttons = {}

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._cycle_buttons.clear()

        main_box = arcade.gui.UIBoxLayout(space_between=14)

        self._add_cycle_row(main_box, "Number of Decks", "num_decks",
                            self.DECK_OPTIONS, str(self.num_decks))
        self._add_cycle_row(main_box, "Player Seats", "num_seats",
                            self.SEAT_OPTIONS, str(self.num_seats))
        self._add_cycle_row(main_box, "Deal Speed", "deal_speed",
                            self.SPEED_OPTIONS, f"{self.deal_speed:.1f}s")
        self._add_cycle_row(main_box, "Poll Every N Cards", "poll_freq",
                            self.POLL_OPTIONS, str(self.poll_freq))

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

    def _add_cycle_row(self, parent, label_text, attr, options, display_text):
        row = arcade.gui.UIBoxLayout(vertical=False, space_between=10)
        lbl = arcade.gui.UILabel(
            text=label_text, width=240, height=40, font_size=16,
            text_color=arcade.color.WHITE, align="right",
        )
        btn = make_button(display_text, width=120, height=40)
        self._cycle_buttons[attr] = (btn, options)

        def on_click(event, a=attr):
            b, opts = self._cycle_buttons[a]
            cur = getattr(self, a)
            try:
                idx = opts.index(cur)
            except ValueError:
                idx = 0
            nxt = opts[(idx + 1) % len(opts)]
            setattr(self, a, nxt)
            b.text = self._format_value(a, nxt)

        btn.on_click = on_click
        row.add(lbl)
        row.add(btn)
        parent.add(row)

    def _format_value(self, attr, value):
        if attr == "deal_speed":
            return f"{value:.1f}s"
        return str(value)

    def _on_back(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def _on_start(self, event):
        from views.counting_trainer import CountingTrainerView
        self.window.show_view(CountingTrainerView(
            num_decks=self.num_decks,
            num_seats=self.num_seats,
            deal_speed=self.deal_speed,
            poll_freq=self.poll_freq,
        ))

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_subtitle.draw()
        self.ui.draw()
