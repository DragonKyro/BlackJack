import arcade
import arcade.gui
from PIL import Image
import io

from views.common import SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN, make_button
from views.strategy_trainer import _load_stats, _save_stats
from utils.stats_analytics import compute_summary, render_heatmap, render_trend, generate_plotly_report


def _png_bytes_to_texture(png_bytes, name):
    """Convert raw PNG bytes to an arcade Texture via PIL."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    return arcade.Texture(img, name)


class StatsView(arcade.View):
    """Stats view: Summary, Heatmap, Trend — with lazy chart rendering."""

    TABS = ['Summary', 'Heatmap', 'Trend']
    HEATMAP_SUBS = ['hard', 'soft', 'pair']
    HEATMAP_SUB_LABELS = ['Hard', 'Soft', 'Pairs']

    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.stats = _load_stats()
        self.active_tab = 0
        self.heatmap_sub = 0

        # Lazy texture caches — None means "needs rendering"
        self._heatmap_textures = [None, None, None]  # hard, soft, pair
        self._trend_texture = None
        self._heatmap_sprites = [None, None, None]
        self._trend_sprite = None

        # Track data version to know when to invalidate
        self._data_version = 0

        self.txt_title = arcade.Text(
            "Training Stats",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 28,
            arcade.color.GOLD, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_key_hints = arcade.Text(
            "1 Summary  |  2 Heatmap  |  3 Trend  |  B Browser Report  |  Esc Back",
            SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=11, anchor_x="center",
        )

        # Summary text objects
        self._summary_texts = []
        y = SCREEN_HEIGHT - 85
        for _ in range(16):
            self._summary_texts.append(arcade.Text(
                "", SCREEN_WIDTH / 2, y,
                arcade.color.WHITE, font_size=15, anchor_x="center",
            ))
            y -= 28

        self._hm_sub_hint = arcade.Text(
            "Q / W  Switch: Hard / Soft / Pairs",
            SCREEN_WIDTH / 2, 42,
            (140, 140, 140), font_size=11, anchor_x="center",
        )

        self._refresh_summary()

    # ------------------------------------------------------------------
    # Lazy rendering
    # ------------------------------------------------------------------
    def _ensure_heatmap(self, idx):
        """Render heatmap texture for sub-index if not cached."""
        if self._heatmap_textures[idx] is not None:
            return
        ht = self.HEATMAP_SUBS[idx]
        history = self.stats.get('history', [])
        png = render_heatmap(history, hand_type=ht,
                             width=SCREEN_WIDTH - 80, height=SCREEN_HEIGHT - 160)
        tex = _png_bytes_to_texture(png, f'heatmap_{ht}_{self._data_version}')
        self._heatmap_textures[idx] = tex
        sprite = arcade.Sprite(tex)
        sprite.center_x = SCREEN_WIDTH / 2
        sprite.center_y = (SCREEN_HEIGHT - 55 + 60) / 2  # vertically center between title and buttons
        self._heatmap_sprites[idx] = sprite

    def _ensure_trend(self):
        """Render trend texture if not cached."""
        if self._trend_texture is not None:
            return
        history = self.stats.get('history', [])
        png = render_trend(history, window=20,
                           width=SCREEN_WIDTH - 80, height=SCREEN_HEIGHT - 160)
        tex = _png_bytes_to_texture(png, f'trend_{self._data_version}')
        self._trend_texture = tex
        sprite = arcade.Sprite(tex)
        sprite.center_x = SCREEN_WIDTH / 2
        sprite.center_y = (SCREEN_HEIGHT - 55 + 60) / 2
        self._trend_sprite = sprite

    def _invalidate_caches(self):
        """Clear all cached textures so they re-render on next display."""
        self._data_version += 1
        self._heatmap_textures = [None, None, None]
        self._heatmap_sprites = [None, None, None]
        self._trend_texture = None
        self._trend_sprite = None

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    def _refresh_summary(self):
        history = self.stats.get('history', [])
        s = compute_summary(history)

        lines = [
            ("Strategy Trainer — Overall", arcade.color.GOLD),
            ("", None),
            (f"Total hands:  {s['total']}", arcade.color.WHITE),
            (f"Correct:  {s['correct']}   ({s['pct']:.1f}%)", arcade.color.WHITE),
            (f"Incorrect:  {s['incorrect']}", arcade.color.WHITE),
            ("", None),
        ]

        for ht in ('hard', 'soft', 'pair'):
            bt = s['by_type'][ht]
            bt_pct = (bt['correct'] / bt['total'] * 100) if bt['total'] > 0 else 0
            lines.append((
                f"{ht.capitalize()}:  {bt['correct']}/{bt['total']}  ({bt_pct:.1f}%)",
                arcade.color.WHITE,
            ))

        lines.append(("", None))
        if s['last_50_n'] >= 10:
            lines.append((
                f"Last {s['last_50_n']} hands:  {s['last_50_pct']:.1f}%",
                (180, 180, 255),
            ))
            lines.append((
                f"Last {s['last_10_n']} hands:  {s['last_10_pct']:.1f}%",
                (180, 180, 255),
            ))
        else:
            lines.append(("Not enough history for trend yet", (160, 160, 160)))

        lines.append(("", None))
        lines.append((f"History entries: {len(history)}", (120, 120, 120)))

        for i, (text, color) in enumerate(lines):
            if i < len(self._summary_texts):
                self._summary_texts[i].text = text
                if color:
                    self._summary_texts[i].color = color

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

    def _build_ui(self):
        self.ui.clear()
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=8)

        for i, name in enumerate(self.TABS):
            btn = make_button(name, width=100, height=36)
            btn.on_click = lambda e, idx=i: self._switch_tab(idx)
            h_box.add(btn)

        browser_btn = make_button("Browser Report", width=160, height=36)
        browser_btn.on_click = self._on_browser_report
        h_box.add(browser_btn)

        clear_btn = make_button("Clear Stats", width=120, height=36)
        clear_btn.on_click = self._on_clear
        h_box.add(clear_btn)

        back_btn = make_button("Back", width=80, height=36)
        back_btn.on_click = self._on_back
        h_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=h_box, anchor_x="center_x", anchor_y="bottom", align_y=38)
        self.ui.add(anchor)

    def _switch_tab(self, idx):
        self.active_tab = idx

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
        self._refresh_summary()
        self._invalidate_caches()

    def _on_browser_report(self, event):
        history = self.stats.get('history', [])
        if history:
            generate_plotly_report(history)

    def on_key_press(self, key, modifiers):
        if key == arcade.key.KEY_1:
            self.active_tab = 0
        elif key == arcade.key.KEY_2:
            self.active_tab = 1
        elif key == arcade.key.KEY_3:
            self.active_tab = 2
        elif key == arcade.key.Q and self.active_tab == 1:
            self.heatmap_sub = (self.heatmap_sub - 1) % 3
        elif key == arcade.key.W and self.active_tab == 1:
            self.heatmap_sub = (self.heatmap_sub + 1) % 3
        elif key == arcade.key.B:
            self._on_browser_report(None)
        elif key == arcade.key.ESCAPE:
            self._on_back(None)

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()

        if self.active_tab == 0:
            for txt in self._summary_texts:
                if txt.text:
                    txt.draw()
        elif self.active_tab == 1:
            self._ensure_heatmap(self.heatmap_sub)
            sprite = self._heatmap_sprites[self.heatmap_sub]
            if sprite:
                sprite.draw()
            self._hm_sub_hint.draw()
        elif self.active_tab == 2:
            self._ensure_trend()
            if self._trend_sprite:
                self._trend_sprite.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
