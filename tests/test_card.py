import pytest
from models import Card


class TestCardValue:
    def test_number_cards(self):
        for rank in ['2', '3', '4', '5', '6', '7', '8', '9']:
            card = Card(rank, 'h')
            assert card.value() == int(rank)

    def test_ten(self):
        assert Card('10', 's').value() == 10

    def test_face_cards(self):
        for rank in ['j', 'q', 'k']:
            assert Card(rank, 'c').value() == 10

    def test_ace_value(self):
        assert Card('a', 'd').value() == 11


class TestCardCount:
    def test_low_cards_positive(self):
        for rank in ['2', '3', '4', '5', '6']:
            assert Card(rank, 'h').count() == 1

    def test_neutral_cards_zero(self):
        for rank in ['7', '8', '9']:
            assert Card(rank, 'h').count() == 0

    def test_high_cards_negative(self):
        for rank in ['10', 'j', 'q', 'k', 'a']:
            assert Card(rank, 'h').count() == -1


class TestCardImagePath:
    def test_image_path_format(self):
        card = Card('a', 'c')
        assert card.get_image_path().endswith('ac.png')

    def test_ten_image_path(self):
        card = Card('10', 'h')
        assert card.get_image_path().endswith('10h.png')


class TestCardStr:
    def test_ace_of_spades(self):
        assert str(Card('a', 's')) == 'Ace of Spades'

    def test_ten_of_hearts(self):
        assert str(Card('10', 'h')) == '10 of Hearts'

    def test_jack_of_clubs(self):
        assert str(Card('j', 'c')) == 'Jack of Clubs'
