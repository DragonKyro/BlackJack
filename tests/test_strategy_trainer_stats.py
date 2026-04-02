import pytest
import json
import os
import tempfile
from unittest.mock import patch
from views.strategy_trainer import _load_stats, _save_stats, _hand_type
from models import Hand, Card, Rules


class TestHandType:
    def test_hard_hand(self):
        h = Hand()
        h.add_card(Card('10', 'h'))
        h.add_card(Card('6', 'd'))
        assert _hand_type(h, Rules()) == 'hard'

    def test_soft_hand(self):
        h = Hand()
        h.add_card(Card('a', 'h'))
        h.add_card(Card('6', 'd'))
        assert _hand_type(h, Rules()) == 'soft'

    def test_pair(self):
        h = Hand()
        h.add_card(Card('8', 'h'))
        h.add_card(Card('8', 'd'))
        assert _hand_type(h, Rules()) == 'pair'

    def test_pair_no_split_is_hard(self):
        h = Hand()
        h.add_card(Card('8', 'h'))
        h.add_card(Card('8', 'd'))
        assert _hand_type(h, Rules(allow_split=False)) == 'hard'

    def test_ace_pair_is_pair(self):
        h = Hand()
        h.add_card(Card('a', 'h'))
        h.add_card(Card('a', 'd'))
        assert _hand_type(h, Rules()) == 'pair'


class TestStatsLoadSave:
    def test_load_empty_returns_defaults(self):
        with patch('views.strategy_trainer.STATS_FILE', '/nonexistent/path.json'):
            stats = _load_stats()
        assert stats['total'] == 0
        assert stats['correct'] == 0
        assert 'by_type' in stats
        assert 'history' in stats

    def test_save_and_load_roundtrip(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            tmp_path = f.name
        try:
            stats = _load_stats()
            stats['total'] = 42
            stats['correct'] = 30
            with patch('views.strategy_trainer.STATS_FILE', tmp_path):
                _save_stats(stats)
                loaded = _load_stats()
            assert loaded['total'] == 42
            assert loaded['correct'] == 30
        finally:
            os.unlink(tmp_path)
