import arcade
import arcade.gui
from models import Rules
from basic_strategy.tables import get_strategy_tables, DEALER_COLS, HARD_ROWS, SOFT_ROWS, PAIR_ROWS
from views.common import SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN, make_button

# Color coding for strategy actions
ACTION_COLORS = {
    'H': (220, 50, 50),      # Red — Hit
    'S': (50, 150, 50),      # Green — Stand
    'D': (50, 100, 220),     # Blue — Double
    'P': (200, 180, 30),     # Yellow — Split
    'R': (160, 80, 200),     # Purple — Surrender
}

# Table rendering constants
CELL_W = 42
CELL_H = 24
HEADER_H = 28
ROW_LABEL_W = 52


class StrategyView(arcade.View):
    """Displays basic strategy tables color-coded by action, adjusted to the current ruleset."""

    TABS = ['Hard', 'Soft', 'Pairs']

    def __init__(self, rules=None, return_view=None):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = rules or Rules()
        self.return_view = return_view  # View to return to (GameView or None → HomeView)
        self.active_tab = 0  # 0=Hard, 1=Soft, 2=Pairs

        self.txt_title = arcade.Text(
            "Basic Strategy",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30,
            arcade.color.GOLD, font_size=32, anchor_x="center", bold=True,
        )
        self.txt_rules_summary = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 58,
            (180, 180, 180), font_size=13, anchor_x="center",
        )
        self.txt_key_hints = arcade.Text(
            "1  Hard  |  2  Soft  |  3  Pairs  |  Esc/T  Back",
            SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

        # Pre-build the strategy data
        self._hard, self._soft, self._pairs = get_strategy_tables(self.rules)

        # Build rules summary
        parts = [
            f"{self.rules.num_decks}D",
            self.rules.dealer_17_label(),
            self.rules.blackjack_label(),
        ]
        if self.rules.allow_double:
            parts.append("DAS" if self.rules.allow_double_after_split else "D")
        if self.rules.allow_surrender:
            parts.append("LS")
        self.txt_rules_summary.text = "  |  ".join(parts)

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._build_ui()

    def on_hide_view(self):
        self.ui.disable()

    def _build_ui(self):
        self.ui.clear()
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=10)

        for i, name in enumerate(self.TABS):
            btn = make_button(name, width=100, height=36)
            btn.on_click = lambda e, idx=i: self._switch_tab(idx)
            h_box.add(btn)

        back_btn = make_button("Back", width=100, height=36)
        back_btn.on_click = self._on_back
        h_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=h_box, anchor_x="center_x", anchor_y="bottom", align_y=40)
        self.ui.add(anchor)

    def _switch_tab(self, idx):
        self.active_tab = idx

    def _on_back(self, event):
        if self.return_view:
            self.window.show_view(self.return_view)
        else:
            from views.home import HomeView
            self.window.show_view(HomeView())

    def on_key_press(self, key, modifiers):
        if key == arcade.key.KEY_1:
            self.active_tab = 0
        elif key == arcade.key.KEY_2:
            self.active_tab = 1
        elif key == arcade.key.KEY_3:
            self.active_tab = 2
        elif key in (arcade.key.ESCAPE, arcade.key.T):
            self._on_back(None)

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_rules_summary.draw()

        if self.active_tab == 0:
            self._draw_table("Hard Totals", HARD_ROWS, self._hard, str)
        elif self.active_tab == 1:
            self._draw_table("Soft Totals", SOFT_ROWS, self._soft, lambda r: f"A+{r - 11}")
        else:
            self._draw_table("Pairs", PAIR_ROWS, self._pairs, lambda r: f"{r},{r}")

        # Legend
        self._draw_legend()

        self.txt_key_hints.draw()
        self.ui.draw()

    def _draw_table(self, title, rows, data, row_label_fn):
        num_cols = len(DEALER_COLS)
        num_rows = len(rows)
        table_w = ROW_LABEL_W + num_cols * CELL_W
        table_h = HEADER_H + num_rows * CELL_H

        # Center the table
        start_x = (SCREEN_WIDTH - table_w) / 2
        start_y = SCREEN_HEIGHT - 100

        # Table title
        arcade.draw_text(
            title,
            start_x + table_w / 2, start_y + 10,
            arcade.color.WHITE, font_size=16, anchor_x="center", bold=True,
        )
        start_y -= 10

        # Column headers (dealer up-card)
        for c, col in enumerate(DEALER_COLS):
            cx = start_x + ROW_LABEL_W + c * CELL_W + CELL_W / 2
            cy = start_y - HEADER_H / 2
            arcade.draw_text(
                col, cx, cy,
                arcade.color.GOLD, font_size=12,
                anchor_x="center", anchor_y="center", bold=True,
            )

        # "Dealer" label
        arcade.draw_text(
            "Dealer \u2192",
            start_x + ROW_LABEL_W / 2, start_y - HEADER_H / 2,
            (180, 180, 180), font_size=10,
            anchor_x="center", anchor_y="center",
        )

        # Rows
        for r, row_key in enumerate(rows):
            ry = start_y - HEADER_H - r * CELL_H

            # Row label
            label = str(row_label_fn(row_key))
            arcade.draw_text(
                label,
                start_x + ROW_LABEL_W / 2, ry - CELL_H / 2,
                arcade.color.WHITE, font_size=11,
                anchor_x="center", anchor_y="center",
            )

            # Cells
            actions = data.get(row_key, ['?'] * 10)
            for c, action in enumerate(actions):
                cx = start_x + ROW_LABEL_W + c * CELL_W
                cy = ry - CELL_H

                color = ACTION_COLORS.get(action, (80, 80, 80))
                arcade.draw_lrbt_rectangle_filled(
                    cx + 1, cx + CELL_W - 1,
                    cy + 1, cy + CELL_H - 1,
                    color,
                )
                arcade.draw_text(
                    action,
                    cx + CELL_W / 2, cy + CELL_H / 2,
                    arcade.color.WHITE, font_size=11,
                    anchor_x="center", anchor_y="center", bold=True,
                )

    def _draw_legend(self):
        legend_y = 80
        legend_x = SCREEN_WIDTH / 2 - 180
        items = [
            ('H', 'Hit'), ('S', 'Stand'), ('D', 'Double'),
            ('P', 'Split'), ('R', 'Surrender'),
        ]
        for action, label in items:
            color = ACTION_COLORS[action]
            arcade.draw_lrbt_rectangle_filled(
                legend_x, legend_x + 20,
                legend_y, legend_y + 14,
                color,
            )
            arcade.draw_text(
                f" {label}", legend_x + 24, legend_y + 1,
                arcade.color.WHITE, font_size=12,
            )
            legend_x += 80
