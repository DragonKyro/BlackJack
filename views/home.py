import arcade
import arcade.gui
from views.common import SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN, make_button


class HomeView(arcade.View):
    def __init__(self):
        super().__init__()
        self.ui = arcade.gui.UIManager()
        self.title_text = arcade.Text(
            "BLACKJACK",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 120,
            arcade.color.GOLD, font_size=64, anchor_x="center", bold=True,
        )
        self.subtitle_text = arcade.Text(
            "Training Software",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 170,
            arcade.color.WHITE, font_size=22, anchor_x="center",
        )

    def on_show_view(self):
        self.ui.enable()
        self.ui.clear()
        self.window.background_color = FELT_GREEN

        v_box = arcade.gui.UIBoxLayout(space_between=16)

        play_btn = make_button("Play Blackjack")
        strat_train_btn = make_button("Strategy Trainer")
        count_train_btn = make_button("Counting Trainer")
        strategy_btn = make_button("Strategy Tables")
        credits_btn = make_button("Credits")
        exit_btn = make_button("Exit")

        play_btn.on_click = self._on_play
        strat_train_btn.on_click = self._on_strategy_trainer
        count_train_btn.on_click = self._on_counting_trainer
        strategy_btn.on_click = self._on_strategy
        credits_btn.on_click = self._on_credits
        exit_btn.on_click = self._on_exit

        v_box.add(play_btn)
        v_box.add(strat_train_btn)
        v_box.add(count_train_btn)
        v_box.add(strategy_btn)
        v_box.add(credits_btn)
        v_box.add(exit_btn)

        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=v_box, anchor_x="center_x", anchor_y="center_y", align_y=-60)
        self.ui.add(anchor)

    def on_hide_view(self):
        self.ui.disable()

    def on_draw(self):
        self.clear()
        self.title_text.draw()
        self.subtitle_text.draw()
        self.ui.draw()

    def _on_play(self, event):
        from views.rules import RulesView
        self.window.show_view(RulesView())

    def _on_strategy_trainer(self, event):
        from views.strategy_trainer_config import StrategyTrainerConfigView
        self.window.show_view(StrategyTrainerConfigView())

    def _on_counting_trainer(self, event):
        from views.counting_trainer_config import CountingTrainerConfigView
        self.window.show_view(CountingTrainerConfigView())

    def _on_strategy(self, event):
        from views.strategy import StrategyView
        self.window.show_view(StrategyView())

    def _on_credits(self, event):
        from views.credits import CreditsView
        self.window.show_view(CreditsView())

    def _on_exit(self, event):
        arcade.exit()
