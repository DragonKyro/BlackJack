import arcade
import arcade.gui
from models import Rules
from basic_strategy.tables import get_strategy_tables, get_deviations, DEALER_COLS, HARD_ROWS, SOFT_ROWS, PAIR_ROWS
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
MAX_ROWS = max(len(HARD_ROWS), len(SOFT_ROWS), len(PAIR_ROWS))
NUM_COLS = len(DEALER_COLS)


def _table_origin():
    table_w = ROW_LABEL_W + NUM_COLS * CELL_W
    start_x = (SCREEN_WIDTH - table_w) / 2
    start_y = SCREEN_HEIGHT - 110
    return start_x, start_y, table_w


class StrategyView(arcade.View):
    """Displays basic strategy tables color-coded by action, adjusted to the current ruleset."""

    TABS = ['Hard', 'Soft', 'Pairs', 'Deviations']

    def __init__(self, rules=None, return_view=None):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = rules or Rules()
        self.return_view = return_view
        self.active_tab = 0

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
            "1  Hard  |  2  Soft  |  3  Pairs  |  4  Deviations  |  Esc/T  Back",
            SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

        # Strategy data
        self._hard, self._soft, self._pairs = get_strategy_tables(self.rules)

        # Rules summary
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

        # --- Pre-build all Text objects for table rendering ---
        sx, sy, tw = _table_origin()

        # Table title text (updated per tab)
        self._txt_table_title = arcade.Text(
            "", sx + tw / 2, sy + 10,
            arcade.color.WHITE, font_size=16, anchor_x="center", bold=True,
        )

        # "Dealer →" label
        self._txt_dealer_arrow = arcade.Text(
            "Dealer \u2192",
            sx + ROW_LABEL_W / 2, sy - HEADER_H / 2,
            (180, 180, 180), font_size=10,
            anchor_x="center", anchor_y="center",
        )

        # Column headers
        self._txt_col_headers = []
        for c, col in enumerate(DEALER_COLS):
            cx = sx + ROW_LABEL_W + c * CELL_W + CELL_W / 2
            cy = sy - HEADER_H / 2
            self._txt_col_headers.append(arcade.Text(
                col, cx, cy,
                arcade.color.GOLD, font_size=12,
                anchor_x="center", anchor_y="center", bold=True,
            ))

        # Row labels (MAX_ROWS — hide unused ones)
        self._txt_row_labels = []
        for r in range(MAX_ROWS):
            ry = sy - HEADER_H - r * CELL_H
            self._txt_row_labels.append(arcade.Text(
                "", sx + ROW_LABEL_W / 2, ry - CELL_H / 2,
                arcade.color.WHITE, font_size=11,
                anchor_x="center", anchor_y="center",
            ))

        # Cell texts (MAX_ROWS x NUM_COLS)
        self._txt_cells = []
        self._cell_rects = []
        for r in range(MAX_ROWS):
            row_texts = []
            row_rects = []
            ry = sy - HEADER_H - r * CELL_H
            for c in range(NUM_COLS):
                cx = sx + ROW_LABEL_W + c * CELL_W
                cy = ry - CELL_H
                row_texts.append(arcade.Text(
                    "", cx + CELL_W / 2, cy + CELL_H / 2,
                    arcade.color.WHITE, font_size=11,
                    anchor_x="center", anchor_y="center", bold=True,
                ))
                row_rects.append((cx + 1, cx + CELL_W - 1, cy + 1, cy + CELL_H - 1))
            self._txt_cells.append(row_texts)
            self._cell_rects.append(row_rects)

        # Cell colors (updated when tab changes)
        self._cell_colors = [[(80, 80, 80)] * NUM_COLS for _ in range(MAX_ROWS)]
        self._visible_rows = 0

        # Legend texts
        legend_y = 80
        legend_x = SCREEN_WIDTH / 2 - 180
        items = [('H', 'Hit'), ('S', 'Stand'), ('D', 'Double'),
                 ('P', 'Split'), ('R', 'Surrender')]
        self._legend_rects = []
        self._legend_texts = []
        for action, label in items:
            self._legend_rects.append((legend_x, legend_x + 20, legend_y, legend_y + 14,
                                       ACTION_COLORS[action]))
            self._legend_texts.append(arcade.Text(
                f" {label}", legend_x + 24, legend_y + 1,
                arcade.color.WHITE, font_size=12,
            ))
            legend_x += 80

        # --- Deviation table text objects ---
        deviations = get_deviations(include_fab4=True)
        self._dev_header_texts = []
        dev_headers = ['Hand', 'vs Dealer', 'TC', 'Play', 'Basic']
        dev_col_x = [160, 310, 410, 490, 580]
        dev_header_y = SCREEN_HEIGHT - 110
        for i, hdr in enumerate(dev_headers):
            self._dev_header_texts.append(arcade.Text(
                hdr, dev_col_x[i], dev_header_y,
                arcade.color.GOLD, font_size=14, anchor_x="center", bold=True,
            ))

        self._dev_section_label = arcade.Text(
            "", SCREEN_WIDTH / 2, dev_header_y + 22,
            arcade.color.WHITE, font_size=15, anchor_x="center", bold=True,
        )

        self._dev_row_texts = []
        max_dev_rows = len(deviations)
        y = dev_header_y - 28
        for d in deviations:
            row = []
            tc_str = f"TC >= {d['tc']}" if d['tc'] >= 0 else f"TC <= {d['tc']}"
            values = [d['hand'], d['dealer_up'], tc_str, d['action'], d['basic_action']]
            colors = [
                arcade.color.WHITE,
                arcade.color.WHITE,
                arcade.color.GOLD,
                ACTION_COLORS.get(d['action'], (200, 200, 200)),
                (150, 150, 150),
            ]
            for i, (val, col) in enumerate(zip(values, colors)):
                row.append(arcade.Text(
                    val, dev_col_x[i], y,
                    col, font_size=13, anchor_x="center",
                ))
            self._dev_row_texts.append(row)
            y -= 24

        # Populate initial tab
        self._last_tab = -1

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._build_ui()
        self._last_tab = -1  # force refresh

    def on_hide_view(self):
        self.ui.disable()

    def _rebuild_tables(self):
        """Regenerate strategy data and summary from current rules."""
        self._hard, self._soft, self._pairs = get_strategy_tables(self.rules)
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
        self._last_tab = -1  # force table redraw

    def _build_ui(self):
        self.ui.clear()
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=10)

        for i, name in enumerate(self.TABS):
            btn = make_button(name, width=100, height=36)
            btn.on_click = lambda e, idx=i: self._switch_tab(idx)
            h_box.add(btn)

        rules_btn = make_button("Rules", width=100, height=36)
        rules_btn.on_click = self._on_change_rules
        h_box.add(rules_btn)

        back_btn = make_button("Back", width=100, height=36)
        back_btn.on_click = self._on_back
        h_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=h_box, anchor_x="center_x", anchor_y="bottom", align_y=40)
        self.ui.add(anchor)

    def _switch_tab(self, idx):
        self.active_tab = idx

    def _on_change_rules(self, event):
        from views.rules import RulesView
        self.window.show_view(RulesView(
            rules=self.rules,
            on_start_callback=self._apply_new_rules,
            start_label="View Strategy",
        ))

    def _apply_new_rules(self, rules):
        """Called by RulesView when user confirms new rules."""
        self.rules = rules
        self._rebuild_tables()
        self.window.show_view(self)

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
        elif key == arcade.key.KEY_4:
            self.active_tab = 3
        elif key in (arcade.key.ESCAPE, arcade.key.T):
            self._on_back(None)

    # ------------------------------------------------------------------
    # Update table text objects when tab changes
    # ------------------------------------------------------------------
    def _refresh_table(self):
        if self.active_tab == 0:
            title, rows, data = "Hard Totals", HARD_ROWS, self._hard
            label_fn = str
        elif self.active_tab == 1:
            title, rows, data = "Soft Totals", SOFT_ROWS, self._soft
            label_fn = lambda r: f"A+{r - 11}"
        else:
            title, rows, data = "Pairs", PAIR_ROWS, self._pairs
            label_fn = lambda r: f"{r},{r}"

        self._txt_table_title.text = title
        self._visible_rows = len(rows)

        for r in range(MAX_ROWS):
            if r < len(rows):
                self._txt_row_labels[r].text = str(label_fn(rows[r]))
                actions = data.get(rows[r], ['?'] * NUM_COLS)
                for c in range(NUM_COLS):
                    action = actions[c]
                    self._txt_cells[r][c].text = action
                    self._cell_colors[r][c] = ACTION_COLORS.get(action, (80, 80, 80))
            else:
                self._txt_row_labels[r].text = ""
                for c in range(NUM_COLS):
                    self._txt_cells[r][c].text = ""

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_rules_summary.draw()

        if self.active_tab == 3:
            # Deviations tab
            self._dev_section_label.text = "Illustrious 18 + Fab 4 Surrenders"
            self._dev_section_label.draw()
            for txt in self._dev_header_texts:
                txt.draw()
            for row in self._dev_row_texts:
                for txt in row:
                    txt.draw()
        else:
            # Strategy grid tabs
            if self.active_tab != self._last_tab:
                self._refresh_table()
                self._last_tab = self.active_tab

            self._txt_table_title.draw()
            self._txt_dealer_arrow.draw()
            for txt in self._txt_col_headers:
                txt.draw()

            for r in range(self._visible_rows):
                self._txt_row_labels[r].draw()
                for c in range(NUM_COLS):
                    lf, rt, bt, tp = self._cell_rects[r][c]
                    arcade.draw_lrbt_rectangle_filled(lf, rt, bt, tp, self._cell_colors[r][c])
                    self._txt_cells[r][c].draw()

            for (lf, rt, bt, tp, color), txt in zip(self._legend_rects, self._legend_texts):
                arcade.draw_lrbt_rectangle_filled(lf, rt, bt, tp, color)
                txt.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
