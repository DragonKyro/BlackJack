import arcade
import arcade.gui
from views.common import SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN, make_button
from views.strategy_trainer import _load_stats, _save_stats, STATS_FILE
import os


class StatsView(arcade.View):
    """View training stats with option to clear."""

    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.stats = _load_stats()

        self.txt_title = arcade.Text(
            "Training Stats",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50,
            arcade.color.GOLD, font_size=36, anchor_x="center", bold=True,
        )

        # Pre-build all stat text objects
        self._stat_texts = []
        y = SCREEN_HEIGHT - 120
        for _ in range(14):
            self._stat_texts.append(arcade.Text(
                "", SCREEN_WIDTH / 2, y,
                arcade.color.WHITE, font_size=16, anchor_x="center",
            ))
            y -= 30

        self.txt_key_hints = arcade.Text(
            "Esc  Back",
            SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )

        self._refresh_texts()

    def _refresh_texts(self):
        s = self.stats
        total = s['total']
        correct = s['correct']
        pct = (correct / total * 100) if total > 0 else 0

        lines = [
            f"Strategy Trainer — Overall",
            f"",
            f"Total hands:  {total}",
            f"Correct:  {correct}   ({pct:.1f}%)",
            f"Incorrect:  {s.get('incorrect', total - correct)}",
            f"",
        ]

        by_type = s.get('by_type', {})
        for ht in ('hard', 'soft', 'pair'):
            bt = by_type.get(ht, {'total': 0, 'correct': 0})
            bt_total = bt['total']
            bt_correct = bt['correct']
            bt_pct = (bt_correct / bt_total * 100) if bt_total > 0 else 0
            lines.append(f"{ht.capitalize()}:  {bt_correct}/{bt_total}  ({bt_pct:.1f}%)")

        # Recent trend (last 50 hands)
        history = s.get('history', [])
        lines.append("")
        if len(history) >= 10:
            recent = history[-50:]
            rc = sum(1 for h in recent if h.get('correct'))
            rpct = rc / len(recent) * 100
            lines.append(f"Last {len(recent)} hands:  {rc}/{len(recent)}  ({rpct:.1f}%)")
        else:
            lines.append("Not enough history for trend yet")

        for i, line in enumerate(lines):
            if i < len(self._stat_texts):
                self._stat_texts[i].text = line
                if i == 0:
                    self._stat_texts[i].color = arcade.color.GOLD
                elif line.startswith("Last"):
                    self._stat_texts[i].color = (180, 180, 255)
                else:
                    self._stat_texts[i].color = arcade.color.WHITE

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=20)

        back_btn = make_button("Back", width=140, height=44)
        back_btn.on_click = self._on_back
        clear_btn = make_button("Clear Stats", width=160, height=44)
        clear_btn.on_click = self._on_clear

        h_box.add(back_btn)
        h_box.add(clear_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=h_box, anchor_x="center_x", anchor_y="bottom", align_y=50)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def _on_back(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def _on_clear(self, event):
        self.stats = {
            'total': 0, 'correct': 0, 'incorrect': 0,
            'by_type': {
                'hard': {'total': 0, 'correct': 0},
                'soft': {'total': 0, 'correct': 0},
                'pair': {'total': 0, 'correct': 0},
            },
            'history': [],
        }
        _save_stats(self.stats)
        self._refresh_texts()

    def on_key_press(self, key, modifiers):
        if key == arcade.key.ESCAPE:
            self._on_back(None)

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        for txt in self._stat_texts:
            if txt.text:
                txt.draw()
        self.txt_key_hints.draw()
        self.ui.draw()
