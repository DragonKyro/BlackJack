import arcade
import arcade.gui
from views.common import SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN, make_button


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
        back_btn.on_click = self._on_back
        v_box.add(back_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-100)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def _on_back(self, event):
        from views.home import HomeView
        self.window.show_view(HomeView())

    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_coming_soon.draw()
        self.ui.draw()
