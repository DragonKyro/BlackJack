import arcade
import arcade.gui
from models import Rules
from bet_spread import BetSpread, analyze_bet_spread
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    make_button, make_cycle_row, ARROW_STYLE,
)

# Layout
COL_TC_X = 60
COL_BET_X = 160
COL_EDGE_X = 260
COL_FREQ_X = 350
COL_EV_X = 450
ROW_START_Y = SCREEN_HEIGHT - 135
ROW_H = 26
SPREAD_HEADER_Y = ROW_START_Y + 20

# True counts shown in the spread editor
TC_RANGE = list(range(-5, 11))


class BetSpreadView(arcade.View):
    """Interactive bet spread editor with live EV / RoR calculations."""

    DECK_OPTIONS = [1, 2, 4, 6, 8]
    UNIT_OPTIONS = [5, 10, 15, 25, 50, 100]
    BANKROLL_OPTIONS = [1000, 2500, 5000, 10000, 20000, 50000, 100000]
    HPH_OPTIONS = [60, 70, 80, 100, 120]
    PENETRATION_OPTIONS = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90]

    def __init__(self, rules=None):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.rules = rules or Rules()
        self.spread = BetSpread()
        self.unit_size = 10.0
        self.bankroll = 10000.0
        self.hands_per_hour = 80
        self._cycle_buttons = {}

        # Selected row in spread editor
        self.selected_tc_idx = 0

        # --- Text objects ---
        self.txt_title = arcade.Text(
            "Bet Spread Analyzer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 25,
            arcade.color.GOLD, font_size=28, anchor_x="center", bold=True,
        )

        # Spread table headers
        headers = [("TC", COL_TC_X), ("Bet", COL_BET_X), ("Edge%", COL_EDGE_X),
                    ("Freq%", COL_FREQ_X), ("EV/hand", COL_EV_X)]
        self._header_texts = []
        for text, x in headers:
            self._header_texts.append(arcade.Text(
                text, x, SPREAD_HEADER_Y,
                arcade.color.GOLD, font_size=13, anchor_x="center", bold=True,
            ))

        # Spread table rows
        self._tc_texts = []
        self._bet_texts = []
        self._edge_texts = []
        self._freq_texts = []
        self._ev_texts = []
        for i, tc in enumerate(TC_RANGE):
            y = ROW_START_Y - i * ROW_H
            self._tc_texts.append(arcade.Text(
                str(tc), COL_TC_X, y, arcade.color.WHITE, font_size=12, anchor_x="center",
            ))
            self._bet_texts.append(arcade.Text(
                "", COL_BET_X, y, arcade.color.WHITE, font_size=12, anchor_x="center",
            ))
            self._edge_texts.append(arcade.Text(
                "", COL_EDGE_X, y, (160, 160, 160), font_size=12, anchor_x="center",
            ))
            self._freq_texts.append(arcade.Text(
                "", COL_FREQ_X, y, (160, 160, 160), font_size=12, anchor_x="center",
            ))
            self._ev_texts.append(arcade.Text(
                "", COL_EV_X, y, arcade.color.WHITE, font_size=12, anchor_x="center",
            ))

        # Selection indicator
        self.txt_cursor = arcade.Text(
            "\u25B6", COL_TC_X - 35, ROW_START_Y,
            arcade.color.GOLD, font_size=14, anchor_x="center",
        )

        # Results panel (right side)
        results_x = 580
        self._result_texts = []
        for i in range(14):
            y = SPREAD_HEADER_Y - i * 28
            self._result_texts.append(arcade.Text(
                "", results_x, y, arcade.color.WHITE, font_size=14,
            ))

        self.txt_results_header = arcade.Text(
            "Results", results_x, SPREAD_HEADER_Y + 24,
            arcade.color.GOLD, font_size=16, bold=True,
        )

        self.txt_key_hints = arcade.Text(
            "\u2191\u2193 Select TC  |  \u2190\u2192 Adjust Bet  |  Esc Back",
            SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

        self._recalculate()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN
        self._build_ui()

    def on_hide_view(self):
        self.ui.disable()

    # ------------------------------------------------------------------
    # UI — settings row at bottom
    # ------------------------------------------------------------------
    def _build_ui(self):
        self.ui.clear()
        self._cycle_buttons.clear()

        main_box = arcade.gui.UIBoxLayout(space_between=6)

        self._add_cycle_row(main_box, "Decks", "num_decks",
                            self.DECK_OPTIONS, str(self.rules.num_decks))
        self._add_cycle_row(main_box, "Penetration", "penetration",
                            self.PENETRATION_OPTIONS, self.rules.penetration_label())
        self._add_cycle_row(main_box, "Unit $", "unit_size",
                            self.UNIT_OPTIONS, f"${int(self.unit_size)}")
        self._add_cycle_row(main_box, "Bankroll", "bankroll",
                            self.BANKROLL_OPTIONS, f"${int(self.bankroll):,}")
        self._add_cycle_row(main_box, "Hands/hr", "hands_per_hour",
                            self.HPH_OPTIONS, str(self.hands_per_hour))

        btn_row = arcade.gui.UIBoxLayout(vertical=False, space_between=15)
        back_btn = make_button("Back", width=120, height=36)
        back_btn.on_click = self._on_back
        preset_btn = make_button("1-12 Spread", width=140, height=36)
        preset_btn.on_click = self._preset_1_12
        conservative_btn = make_button("1-8 Spread", width=140, height=36)
        conservative_btn.on_click = self._preset_1_8
        flat_btn = make_button("Flat Bet", width=120, height=36)
        flat_btn.on_click = self._preset_flat

        btn_row.add(back_btn)
        btn_row.add(flat_btn)
        btn_row.add(conservative_btn)
        btn_row.add(preset_btn)
        main_box.add(btn_row)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=main_box, anchor_x="right", anchor_y="bottom",
                    align_x=-30, align_y=40)
        self.ui.add(anchor)

    def _add_cycle_row(self, parent, label_text, attr, options, display_text):
        def _step(delta, a=attr):
            def handler(event):
                b, opts = self._cycle_buttons[a]
                cur = self._get_setting(a)
                try:
                    idx = opts.index(cur)
                except ValueError:
                    idx = 0
                nxt = opts[(idx + delta) % len(opts)]
                self._set_setting(a, nxt)
                b.text = self._format_setting(a, nxt)
                self._recalculate()
            return handler

        row, val_btn = make_cycle_row(
            label_text, display_text,
            on_prev=_step(-1), on_next=_step(1),
            label_width=100, value_width=100, height=30,
        )
        self._cycle_buttons[attr] = (val_btn, options)
        parent.add(row)

    def _get_setting(self, attr):
        if attr in ('num_decks', 'penetration'):
            return getattr(self.rules, attr)
        return getattr(self, attr)

    def _set_setting(self, attr, value):
        if attr in ('num_decks', 'penetration'):
            setattr(self.rules, attr, value)
        else:
            setattr(self, attr, value)

    def _format_setting(self, attr, value):
        if attr == 'penetration':
            return f"{int(value * 100)}%"
        if attr == 'unit_size':
            return f"${int(value)}"
        if attr == 'bankroll':
            return f"${int(value):,}"
        return str(value)

    # ------------------------------------------------------------------
    # Presets
    # ------------------------------------------------------------------
    def _preset_1_12(self, event):
        self.spread = BetSpread(spread={
            tc: (0 if tc <= -3 else 1 if tc <= 1 else
                 2 if tc == 2 else 4 if tc == 3 else
                 8 if tc == 4 else 12)
            for tc in range(-7, 11)
        })
        self._recalculate()

    def _preset_1_8(self, event):
        self.spread = BetSpread(spread={
            tc: (0 if tc <= -3 else 1 if tc <= 1 else
                 2 if tc == 2 else 4 if tc == 3 else
                 6 if tc == 4 else 8)
            for tc in range(-7, 11)
        })
        self._recalculate()

    def _preset_flat(self, event):
        self.spread = BetSpread(spread={tc: 1 for tc in range(-7, 11)})
        self._recalculate()

    # ------------------------------------------------------------------
    # Keyboard
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if key == arcade.key.UP:
            self.selected_tc_idx = max(0, self.selected_tc_idx - 1)
        elif key == arcade.key.DOWN:
            self.selected_tc_idx = min(len(TC_RANGE) - 1, self.selected_tc_idx + 1)
        elif key == arcade.key.RIGHT:
            tc = TC_RANGE[self.selected_tc_idx]
            cur = self.spread.get_bet(tc)
            self.spread.spread[tc] = min(cur + 1, 50)
            self._recalculate()
        elif key == arcade.key.LEFT:
            tc = TC_RANGE[self.selected_tc_idx]
            cur = self.spread.get_bet(tc)
            self.spread.spread[tc] = max(cur - 1, 0)
            self._recalculate()
        elif key == arcade.key.ESCAPE:
            self._on_back(None)

    def _on_back(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    # ------------------------------------------------------------------
    # Recalculate
    # ------------------------------------------------------------------
    def _recalculate(self):
        results = analyze_bet_spread(
            self.rules, self.spread,
            unit_size=self.unit_size,
            bankroll=self.bankroll,
            hands_per_hour=self.hands_per_hour,
        )

        # Update spread table
        detail_map = {d['tc']: d for d in results.tc_details}
        for i, tc in enumerate(TC_RANGE):
            bet = self.spread.get_bet(tc)
            self._bet_texts[i].text = str(bet) if bet > 0 else "Sit"
            self._bet_texts[i].color = arcade.color.GOLD if bet > 0 else (100, 100, 100)

            d = detail_map.get(tc)
            if d:
                edge = d['edge_pct']
                self._edge_texts[i].text = f"{edge:+.2f}"
                self._edge_texts[i].color = (100, 220, 100) if edge > 0 else (220, 100, 100)
                self._freq_texts[i].text = f"{d['freq_pct']:.1f}"
                ev = d['ev_per_hand']
                self._ev_texts[i].text = f"{ev:+.4f}"
                self._ev_texts[i].color = (100, 220, 100) if ev > 0 else (220, 100, 100)
            else:
                self._edge_texts[i].text = ""
                self._freq_texts[i].text = ""
                self._ev_texts[i].text = ""

        # Update results panel
        r = results
        unit_str = f"${r.unit_size:.0f}"
        lines = [
            f"Base edge: {r.base_edge_pct:+.2f}%",
            f"Avg bet: {r.avg_bet_units:.2f} units ({r.avg_bet_units * r.unit_size:.0f}$)",
            "",
            f"EV/hand: {r.ev_per_hand_units:+.4f} u",
            f"EV/hour: {r.ev_per_hour_units:+.2f} u",
            f"EV/hour: ${r.ev_per_hour_dollars:+.2f}",
            "",
            f"SD/hand: {r.sd_per_hand_units:.2f} u",
            f"SD/hour: {r.sd_per_hour_units:.2f} u",
            f"SD/hour: ${r.sd_per_hour_dollars:.2f}",
            "",
            f"Risk of Ruin: {r.risk_of_ruin_pct:.1f}%",
            f"Bankroll: {r.bankroll_units:.0f} u (${self.bankroll:,.0f})",
        ]
        if r.n50_hours < float('inf') and r.n50_hours > 0:
            lines.append(f"N0 (break-even): {r.n50_hours:.0f} hrs")
        else:
            lines.append(f"N0: N/A (negative EV)")

        for i, line in enumerate(lines):
            if i < len(self._result_texts):
                self._result_texts[i].text = line
                if line.startswith("EV/hour: $"):
                    val = r.ev_per_hour_dollars
                    self._result_texts[i].color = (100, 220, 100) if val > 0 else (220, 100, 100)
                elif line.startswith("Risk of Ruin"):
                    ror = r.risk_of_ruin_pct
                    if ror < 5:
                        self._result_texts[i].color = (100, 220, 100)
                    elif ror < 20:
                        self._result_texts[i].color = arcade.color.YELLOW
                    else:
                        self._result_texts[i].color = (220, 100, 100)
                elif line == "":
                    self._result_texts[i].color = arcade.color.WHITE
                else:
                    self._result_texts[i].color = arcade.color.WHITE

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()

        # Spread table
        for txt in self._header_texts:
            txt.draw()

        # Selection cursor
        sel_y = ROW_START_Y - self.selected_tc_idx * ROW_H
        self.txt_cursor.y = sel_y
        self.txt_cursor.draw()

        # Highlight selected row
        y = sel_y
        arcade.draw_lrbt_rectangle_filled(
            COL_TC_X - 45, COL_EV_X + 45,
            y - ROW_H // 2 + 2, y + ROW_H // 2 + 2,
            (255, 255, 255, 25),
        )

        for i in range(len(TC_RANGE)):
            self._tc_texts[i].draw()
            self._bet_texts[i].draw()
            self._edge_texts[i].draw()
            self._freq_texts[i].draw()
            self._ev_texts[i].draw()

        # Separator
        arcade.draw_line(
            520, SPREAD_HEADER_Y + 30, 520, 120,
            (80, 80, 80), 1,
        )

        # Results
        self.txt_results_header.draw()
        for txt in self._result_texts:
            if txt.text:
                txt.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
