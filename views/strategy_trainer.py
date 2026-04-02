import json
import os
import random
import time
from collections import defaultdict

import arcade
import arcade.gui
from models import Rules, Deck, Hand, Card, RANKS, SUITS
from basic_strategy.tables import lookup_action
from views.common import (
    SCREEN_WIDTH, SCREEN_HEIGHT, FELT_GREEN,
    CARD_SCALE, CARD_SPACING, get_card_texture, make_button,
)

ACTION_NAMES = {'H': 'Hit', 'S': 'Stand', 'D': 'Double', 'P': 'Split', 'R': 'Surrender'}
_ACTION_BAR_Y = 50

STATS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'strategy_stats.json')

FEEDBACK_DURATION = 1.5

# Animation
SHOE_X = SCREEN_WIDTH - 100
SHOE_Y = SCREEN_HEIGHT - 80
ANIM_DURATION = 0.18
ANIM_STAGGER = 0.12


def _load_stats():
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    return {
        'total': 0, 'correct': 0, 'incorrect': 0,
        'by_type': {
            'hard': {'total': 0, 'correct': 0},
            'soft': {'total': 0, 'correct': 0},
            'pair': {'total': 0, 'correct': 0},
        },
        'history': [],
    }


def _save_stats(stats):
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)


def _hand_type(hand, rules):
    cards = hand.cards
    if (len(cards) == 2 and rules.allow_split
            and cards[0].value() == cards[1].value()):
        return 'pair'
    if hand.is_soft():
        return 'soft'
    return 'hard'


class _CardAnim:
    __slots__ = ('sprite', 'start_x', 'start_y', 'end_x', 'end_y',
                 'duration', 'delay', 'done')

    def __init__(self, sprite, end_x, end_y, delay=0.0, duration=ANIM_DURATION):
        self.sprite = sprite
        self.start_x = SHOE_X
        self.start_y = SHOE_Y
        self.end_x = end_x
        self.end_y = end_y
        self.duration = duration
        self.delay = delay
        self.done = False


def _build_targeted_hand(mode, rules, stats):
    """Build a player hand (2 cards) + dealer up card targeting a specific hand type.

    Returns (player_card1, player_card2, dealer_up_card) as Card objects.
    """
    def _rand_suit():
        return random.choice(SUITS)

    def _rand_rank():
        return random.choice(RANKS)

    def _rand_card():
        return Card(_rand_rank(), _rand_suit())

    dealer_up = _rand_card()

    if mode == 'Hard':
        # Two non-ace cards that don't form a pair, total 5-20
        while True:
            r1 = random.choice([r for r in RANKS if r != 'a'])
            r2 = random.choice([r for r in RANKS if r != 'a'])
            c1 = Card(r1, _rand_suit())
            c2 = Card(r2, _rand_suit())
            if c1.value() != c2.value():
                total = c1.value() + c2.value()
                if 5 <= total <= 20:
                    return c1, c2, dealer_up

    elif mode == 'Soft':
        # One ace + one non-ace
        r2 = random.choice([r for r in RANKS if r != 'a'])
        c1 = Card('a', _rand_suit())
        c2 = Card(r2, _rand_suit())
        return c1, c2, dealer_up

    elif mode == 'Pairs':
        # Two cards of same value
        r = random.choice(RANKS)
        c1 = Card(r, _rand_suit())
        c2 = Card(r, random.choice([s for s in SUITS if s != c1.suit]) if r != '10' else _rand_suit())
        # For face cards, pick two with same value but could be different ranks
        if r in ('j', 'q', 'k', '10'):
            r2 = random.choice(['10', 'j', 'q', 'k'])
            c2 = Card(r2, _rand_suit())
        return c1, c2, dealer_up

    elif mode == 'Smart':
        # Analyze history to find weak spots, bias toward them
        history = stats.get('history', [])
        if len(history) < 20:
            return _build_targeted_hand('Random', rules, stats)

        # Build error rates by (hand_type, player_val, dealer_up_value)
        key_counts = defaultdict(lambda: {'total': 0, 'wrong': 0})
        for h in history:
            key = (h.get('type', 'hard'), h.get('player_val', 0))
            key_counts[key]['total'] += 1
            if not h.get('correct', True):
                key_counts[key]['wrong'] += 1

        # Find all keys that have been seen, weight by error rate
        # Also give weight to unseen combinations
        all_keys = set()
        for ht in ('hard', 'soft', 'pair'):
            if ht == 'hard':
                for v in range(5, 21):
                    all_keys.add((ht, v))
            elif ht == 'soft':
                for v in range(13, 21):
                    all_keys.add((ht, v))
            elif ht == 'pair':
                for v in (4, 6, 8, 10, 12, 14, 16, 18, 20, 12):  # pair values
                    all_keys.add((ht, v))

        weights = {}
        for key in all_keys:
            data = key_counts.get(key)
            if data is None or data['total'] == 0:
                weights[key] = 5.0  # unseen = high weight
            else:
                error_rate = data['wrong'] / data['total']
                weights[key] = 1.0 + error_rate * 10.0  # bias toward errors

        # Weighted random selection
        keys = list(weights.keys())
        w = [weights[k] for k in keys]
        chosen = random.choices(keys, weights=w, k=1)[0]
        ht, val = chosen

        if ht == 'pair':
            card_val = val // 2
            if card_val == 11:
                return _build_targeted_hand('Pairs', rules, stats)
            rank_map = {2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
                        8: '8', 9: '9', 10: '10'}
            r = rank_map.get(card_val, '10')
            c1 = Card(r, _rand_suit())
            c2 = Card(r, _rand_suit())
            return c1, c2, dealer_up
        elif ht == 'soft':
            non_ace_val = val - 11
            rank_map = {2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
                        8: '8', 9: '9'}
            r = rank_map.get(non_ace_val)
            if r:
                return Card('a', _rand_suit()), Card(r, _rand_suit()), dealer_up
            return _build_targeted_hand('Soft', rules, stats)
        else:  # hard
            # Pick two non-ace cards summing to val
            attempts = 0
            while attempts < 50:
                r1 = random.choice([r for r in RANKS if r != 'a'])
                c1 = Card(r1, _rand_suit())
                need = val - c1.value()
                if 2 <= need <= 10:
                    r2_map = {2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
                              8: '8', 9: '9', 10: '10'}
                    r2 = r2_map.get(need)
                    if r2 and c1.value() != need:  # avoid pairs
                        return c1, Card(r2, _rand_suit()), dealer_up
                attempts += 1
            return _build_targeted_hand('Hard', rules, stats)

    # Random (default)
    c1 = _rand_card()
    c2 = _rand_card()
    return c1, c2, dealer_up


class StrategyTrainerView(arcade.View):
    """Rapid-fire basic strategy training. No betting — just decisions."""

    DEALER_Y = 560
    PLAYER_Y = 320
    CARDS_START_X = 380

    def __init__(self, rules=None, deal_mode='Random'):
        super().__init__()
        self.rules = rules or Rules()
        self.deal_mode = deal_mode
        self.ui = arcade.gui.UIManager()
        self.deck = Deck(self.rules.num_decks)
        self.stats = _load_stats()

        # Game state: 'animating', 'playing', 'feedback'
        self.player_hand = Hand()
        self.dealer_up_card = None
        self.dealer_hole_card = None
        self.state = 'animating'
        self.correct_action = ''
        self.player_action = ''
        self.was_correct = False
        self.feedback_timer = 0.0

        # Animation
        self._animations = []
        self._anim_time = 0.0
        self._anim_callback = None

        # Session stats
        self.session_total = 0
        self.session_correct = 0

        # Sprites
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # --- Text objects ---
        self.txt_title = arcade.Text(
            "Strategy Trainer",
            SCREEN_WIDTH / 2, SCREEN_HEIGHT - 25,
            arcade.color.GOLD, font_size=24, anchor_x="center", bold=True,
        )
        self.txt_rules_info = arcade.Text(
            "", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50,
            (160, 160, 160), font_size=11, anchor_x="center",
        )
        self.txt_dealer_label = arcade.Text(
            "Dealer", 20, self.DEALER_Y + 30,
            arcade.color.WHITE, font_size=16,
        )
        self.txt_player_label = arcade.Text(
            "Player", 20, self.PLAYER_Y + 30,
            arcade.color.WHITE, font_size=16,
        )
        self.txt_player_value = arcade.Text(
            "", 20, self.PLAYER_Y - 35,
            arcade.color.GOLD, font_size=16,
        )
        self.txt_dealer_showing = arcade.Text(
            "", 20, self.DEALER_Y - 35,
            arcade.color.GOLD, font_size=16,
        )
        self.txt_feedback = arcade.Text(
            "", SCREEN_WIDTH / 2, self.PLAYER_Y - 80,
            arcade.color.GREEN, font_size=28, anchor_x="center", bold=True,
        )
        self.txt_session_stats = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 25,
            arcade.color.WHITE, font_size=14, anchor_x="right",
        )
        self.txt_lifetime_stats = arcade.Text(
            "", SCREEN_WIDTH - 20, SCREEN_HEIGHT - 48,
            (160, 160, 160), font_size=12, anchor_x="right",
        )
        self.txt_key_hints = arcade.Text(
            "", SCREEN_WIDTH / 2, 12,
            (150, 150, 150), font_size=12, anchor_x="center",
        )
        self.txt_hand_type = arcade.Text(
            "", 20, self.PLAYER_Y - 55,
            (160, 160, 160), font_size=12,
        )

        # Build rules summary
        parts = [
            f"{self.rules.num_decks}D", self.rules.dealer_17_label(),
            self.rules.blackjack_label(),
        ]
        if self.rules.allow_double:
            parts.append("DAS" if self.rules.allow_double_after_split else "D")
        if self.rules.allow_surrender:
            parts.append("LS")
        if self.rules.allow_split:
            parts.append("SP")
        parts.append(f"Mode: {self.deal_mode}")
        self.txt_rules_info.text = "  |  ".join(parts)

        self._deal_hand()

    # ------------------------------------------------------------------
    # View lifecycle
    # ------------------------------------------------------------------
    def on_show_view(self):
        self.ui.enable()
        self.window.background_color = FELT_GREEN
        if self.state == 'playing':
            self._setup_playing_ui()

    def on_hide_view(self):
        self.ui.disable()
        _save_stats(self.stats)

    # ------------------------------------------------------------------
    # Animation engine
    # ------------------------------------------------------------------
    @property
    def _animating(self):
        return len(self._animations) > 0

    def _queue_anim(self, sprite, end_x, end_y, delay=0.0):
        sprite.visible = False
        sprite.center_x = SHOE_X
        sprite.center_y = SHOE_Y
        self._animations.append(_CardAnim(sprite, end_x, end_y, delay))

    def _start_anims(self, callback=None):
        self._anim_time = 0.0
        self._anim_callback = callback
        self.state = 'animating'
        self.ui.clear()

    def _tick_anims(self, delta_time):
        if not self._animations:
            return
        self._anim_time += delta_time
        all_done = True
        for a in self._animations:
            if a.done:
                continue
            if self._anim_time < a.delay:
                all_done = False
                continue
            all_done = False
            a.sprite.visible = True
            elapsed = self._anim_time - a.delay
            t = min(elapsed / a.duration, 1.0)
            ease = 1 - (1 - t) ** 2
            a.sprite.center_x = a.start_x + (a.end_x - a.start_x) * ease
            a.sprite.center_y = a.start_y + (a.end_y - a.start_y) * ease
            if t >= 1.0:
                a.done = True
                a.sprite.center_x = a.end_x
                a.sprite.center_y = a.end_y
        if all_done:
            self._animations.clear()
            if self._anim_callback:
                cb = self._anim_callback
                self._anim_callback = None
                cb()

    # ------------------------------------------------------------------
    # Dealing
    # ------------------------------------------------------------------
    def _deal_hand(self):
        if self.deck.num_remaining() < self.rules.num_decks * 52 * (1 - self.rules.penetration):
            self.deck.shuffle()

        self.player_hand = Hand()

        if self.deal_mode == 'Random':
            self.player_hand.add_card(self.deck.next_card())
            self.dealer_up_card = self.deck.next_card()
            self.player_hand.add_card(self.deck.next_card())
            self.dealer_hole_card = self.deck.next_card()
        else:
            c1, c2, dealer_up = _build_targeted_hand(self.deal_mode, self.rules, self.stats)
            self.player_hand.add_card(c1)
            self.dealer_up_card = dealer_up
            self.player_hand.add_card(c2)
            self.dealer_hole_card = Card(random.choice(RANKS), random.choice(SUITS))

        self.correct_action = lookup_action(
            self.rules, self.player_hand, self.dealer_up_card.rank,
        )
        self.player_action = ''
        self.was_correct = False
        self.feedback_timer = 0.0

        self._build_sprites()
        self._animate_deal()

    def _build_sprites(self):
        self.dealer_sprites = arcade.SpriteList()
        self.player_sprites = arcade.SpriteList()

        # Dealer up card
        tex = get_card_texture(self.dealer_up_card.get_image_path())
        s = arcade.Sprite(tex, scale=CARD_SCALE)
        s.center_x = self.CARDS_START_X
        s.center_y = self.DEALER_Y
        self.dealer_sprites.append(s)

        # Dealer hole card (face down)
        tex2 = get_card_texture(Deck.get_back_image_path())
        s2 = arcade.Sprite(tex2, scale=CARD_SCALE)
        s2.center_x = self.CARDS_START_X + CARD_SPACING
        s2.center_y = self.DEALER_Y
        self.dealer_sprites.append(s2)

        # Player cards
        for i, card in enumerate(self.player_hand.cards):
            tex = get_card_texture(card.get_image_path())
            sp = arcade.Sprite(tex, scale=CARD_SCALE)
            sp.center_x = self.CARDS_START_X + i * CARD_SPACING
            sp.center_y = self.PLAYER_Y
            self.player_sprites.append(sp)

    def _animate_deal(self):
        # Order: player0, dealer up, player1, dealer hole
        order = [
            (self.player_sprites, 0, self.PLAYER_Y),
            (self.dealer_sprites, 0, self.DEALER_Y),
            (self.player_sprites, 1, self.PLAYER_Y),
            (self.dealer_sprites, 1, self.DEALER_Y),
        ]
        for i, (slist, idx, y) in enumerate(order):
            sprite = slist[idx]
            target_x = self.CARDS_START_X + idx * CARD_SPACING
            self._queue_anim(sprite, target_x, y, delay=i * ANIM_STAGGER)

        self._start_anims(callback=self._on_deal_complete)

    def _on_deal_complete(self):
        self.state = 'playing'
        self._setup_playing_ui()

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------
    def _anchor_bottom(self, widget):
        anchor = arcade.gui.UIAnchorLayout()
        anchor.add(child=widget, anchor_x="center_x", anchor_y="bottom",
                    align_y=_ACTION_BAR_Y)
        self.ui.add(anchor)

    def _setup_playing_ui(self):
        self.ui.clear()
        h_box = arcade.gui.UIBoxLayout(vertical=False, space_between=10)

        hit_btn = make_button("Hit (H)", width=110, height=44)
        stand_btn = make_button("Stand (S)", width=110, height=44)
        hit_btn.on_click = lambda e: self._submit_action('H')
        stand_btn.on_click = lambda e: self._submit_action('S')
        h_box.add(hit_btn)
        h_box.add(stand_btn)

        if self.rules.allow_double:
            dbl_btn = make_button("Double (D)", width=120, height=44)
            dbl_btn.on_click = lambda e: self._submit_action('D')
            h_box.add(dbl_btn)

        if self.rules.allow_split:
            split_btn = make_button("Split (P)", width=110, height=44)
            split_btn.on_click = lambda e: self._submit_action('P')
            h_box.add(split_btn)

        if self.rules.allow_surrender:
            surr_btn = make_button("Surrender (R)", width=140, height=44)
            surr_btn.on_click = lambda e: self._submit_action('R')
            h_box.add(surr_btn)

        self._anchor_bottom(h_box)

        hints = "H  Hit  |  S  Stand"
        if self.rules.allow_double:
            hints += "  |  D  Double"
        if self.rules.allow_split:
            hints += "  |  P  Split"
        if self.rules.allow_surrender:
            hints += "  |  R  Surrender"
        self.txt_key_hints.text = hints + "  |  Esc  Menu"

    def _setup_feedback_ui(self):
        self.ui.clear()

    # ------------------------------------------------------------------
    # Action submission
    # ------------------------------------------------------------------
    def _submit_action(self, action):
        if self.state != 'playing':
            return

        self.player_action = action
        self.was_correct = (action == self.correct_action)
        self.state = 'feedback'
        self.feedback_timer = 0.0

        self.session_total += 1
        self.stats['total'] += 1
        if self.was_correct:
            self.session_correct += 1
            self.stats['correct'] += 1
        else:
            self.stats['incorrect'] += 1

        ht = _hand_type(self.player_hand, self.rules)
        self.stats['by_type'][ht]['total'] += 1
        if self.was_correct:
            self.stats['by_type'][ht]['correct'] += 1

        self.stats['history'].append({
            'ts': int(time.time()),
            'correct': self.was_correct,
            'type': ht,
            'player_val': self.player_hand.value(),
            'dealer_up': str(self.dealer_up_card),
            'dealer_rank': self.dealer_up_card.rank,
            'your': action,
            'answer': self.correct_action,
        })
        if len(self.stats['history']) > 2000:
            self.stats['history'] = self.stats['history'][-2000:]

        if self.was_correct:
            self.txt_feedback.text = "Correct!"
            self.txt_feedback.color = arcade.color.GREEN
        else:
            ans = ACTION_NAMES.get(self.correct_action, self.correct_action)
            self.txt_feedback.text = f"Incorrect — correct: {ans}"
            self.txt_feedback.color = arcade.color.RED

        self._setup_feedback_ui()

    # ------------------------------------------------------------------
    # Keyboard
    # ------------------------------------------------------------------
    def on_key_press(self, key, modifiers):
        if self._animating:
            return
        if self.state == 'playing':
            if key == arcade.key.H:
                self._submit_action('H')
            elif key == arcade.key.S:
                self._submit_action('S')
            elif key == arcade.key.D and self.rules.allow_double:
                self._submit_action('D')
            elif key == arcade.key.P and self.rules.allow_split:
                self._submit_action('P')
            elif key == arcade.key.R and self.rules.allow_surrender:
                self._submit_action('R')
            elif key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())
        elif self.state == 'feedback':
            if key == arcade.key.ESCAPE:
                from views.home import HomeView
                self.window.show_view(HomeView())
            else:
                self._next_hand()

    # ------------------------------------------------------------------
    # Update loop
    # ------------------------------------------------------------------
    def on_update(self, delta_time):
        self._tick_anims(delta_time)
        if self.state == 'feedback':
            self.feedback_timer += delta_time
            if self.feedback_timer >= FEEDBACK_DURATION:
                self._next_hand()

    def _next_hand(self):
        self._deal_hand()

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------
    def on_draw(self):
        self.clear()
        self.txt_title.draw()
        self.txt_rules_info.draw()

        self.txt_dealer_label.draw()
        self.txt_player_label.draw()

        self.dealer_sprites.draw()
        self.player_sprites.draw()

        # Only show values after deal animation completes
        if self.state in ('playing', 'feedback'):
            self.txt_player_value.text = f"Value: {self.player_hand.value()}"
            self.txt_player_value.draw()

            up_show = "A" if self.dealer_up_card.rank == 'a' else str(self.dealer_up_card.value())
            self.txt_dealer_showing.text = f"Showing: {up_show}"
            self.txt_dealer_showing.draw()

            ht = _hand_type(self.player_hand, self.rules)
            self.txt_hand_type.text = f"Type: {ht.capitalize()}"
            self.txt_hand_type.draw()

        pct = (self.session_correct / self.session_total * 100) if self.session_total > 0 else 0
        self.txt_session_stats.text = (
            f"Session: {self.session_correct}/{self.session_total}  ({pct:.0f}%)"
        )
        self.txt_session_stats.draw()

        lt = self.stats['total']
        lc = self.stats['correct']
        lpct = (lc / lt * 100) if lt > 0 else 0
        self.txt_lifetime_stats.text = f"Lifetime: {lc}/{lt}  ({lpct:.0f}%)"
        self.txt_lifetime_stats.draw()

        if self.state == 'feedback':
            self.txt_feedback.draw()

        self.txt_key_hints.draw()
        self.ui.draw()
