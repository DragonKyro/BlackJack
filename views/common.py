import arcade
import arcade.gui

SCREEN_WIDTH = 1024
SCREEN_HEIGHT = 768
SCREEN_TITLE = "Blackjack Trainer"

FELT_GREEN = (35, 101, 51)
CARD_SCALE = 0.9
CARD_WIDTH = int(100 * CARD_SCALE)
CARD_HEIGHT = int(140 * CARD_SCALE)
CARD_SPACING = 90

# --- Texture Cache ---
_texture_cache = {}


def get_card_texture(path):
    if path not in _texture_cache:
        _texture_cache[path] = arcade.load_texture(path)
    return _texture_cache[path]


# --- Button Styling ---
BUTTON_STYLE = {
    "normal": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=arcade.color.DIM_GRAY,
        border=arcade.color.WHITE,
        border_width=2,
    ),
    "hover": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=arcade.color.GRAY,
        border=arcade.color.GOLD,
        border_width=2,
    ),
    "press": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=arcade.color.DARK_GRAY,
        border=arcade.color.GOLD,
        border_width=2,
    ),
}

TOGGLE_ON_STYLE = {
    "normal": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(40, 120, 40),
        border=arcade.color.GREEN,
        border_width=2,
    ),
    "hover": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(50, 140, 50),
        border=arcade.color.GOLD,
        border_width=2,
    ),
    "press": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(30, 100, 30),
        border=arcade.color.GOLD,
        border_width=2,
    ),
}

TOGGLE_OFF_STYLE = {
    "normal": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.LIGHT_GRAY,
        bg=(100, 40, 40),
        border=arcade.color.DARK_RED,
        border_width=2,
    ),
    "hover": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(120, 50, 50),
        border=arcade.color.GOLD,
        border_width=2,
    ),
    "press": arcade.gui.UIFlatButton.UIStyle(
        font_color=arcade.color.WHITE,
        bg=(80, 30, 30),
        border=arcade.color.GOLD,
        border_width=2,
    ),
}


def make_button(text, width=200, height=50):
    return arcade.gui.UIFlatButton(text=text, width=width, height=height, style=BUTTON_STYLE)
