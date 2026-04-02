import arcade
from views import HomeView, SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE


def main():
    window = arcade.Window(SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE)
    home_view = HomeView()
    window.show_view(home_view)
    arcade.run()


if __name__ == '__main__':
    main()
