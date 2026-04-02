"""
Stats analytics engine — pandas for calculations, matplotlib for in-app charts,
plotly for interactive HTML reports.
"""

import io
import os
import webbrowser
import tempfile

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.patches import FancyBboxPatch
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from basic_strategy.tables import DEALER_COLS, HARD_ROWS, SOFT_ROWS, PAIR_ROWS

# Map dealer rank to column label
_RANK_TO_COL = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', '10': '10',
    'j': '10', 'q': '10', 'k': '10', 'a': 'A',
}

# Pair value → row label
_PAIR_VAL_TO_LABEL = {
    12: 'A', 22: 'A', 20: '10', 18: '9', 16: '8', 14: '7',
    12: '6', 10: '5', 8: '4', 6: '3', 4: '2',
}


def _history_to_df(history):
    """Convert history list to a pandas DataFrame with cleaned columns."""
    if not history:
        return pd.DataFrame(columns=[
            'ts', 'correct', 'type', 'player_val', 'dealer_col',
            'your', 'answer',
        ])
    df = pd.DataFrame(history)
    # Map dealer_rank to column label
    if 'dealer_rank' in df.columns:
        df['dealer_col'] = df['dealer_rank'].map(_RANK_TO_COL).fillna('')
    else:
        df['dealer_col'] = ''
    df['correct'] = df['correct'].astype(bool)
    return df


# =========================================================================
# Summary stats via pandas
# =========================================================================

def compute_summary(history):
    """Return summary dict with overall and per-type stats."""
    df = _history_to_df(history)
    total = len(df)
    correct = int(df['correct'].sum()) if total > 0 else 0

    by_type = {}
    for ht in ('hard', 'soft', 'pair'):
        sub = df[df['type'] == ht]
        by_type[ht] = {
            'total': len(sub),
            'correct': int(sub['correct'].sum()) if len(sub) > 0 else 0,
        }

    recent_50 = df.tail(50)
    recent_10 = df.tail(10)

    return {
        'total': total,
        'correct': correct,
        'incorrect': total - correct,
        'pct': (correct / total * 100) if total > 0 else 0,
        'by_type': by_type,
        'last_50_pct': (recent_50['correct'].mean() * 100) if len(recent_50) > 0 else 0,
        'last_10_pct': (recent_10['correct'].mean() * 100) if len(recent_10) > 0 else 0,
        'last_50_n': len(recent_50),
        'last_10_n': len(recent_10),
    }


# =========================================================================
# Matplotlib chart rendering → PNG bytes
# =========================================================================

def _fig_to_png_bytes(fig, dpi=100):
    """Render a matplotlib figure to PNG bytes in memory."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight',
                facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# Dark theme for matplotlib
_BG_COLOR = '#1a3320'
_TEXT_COLOR = '#e0e0e0'
_GRID_COLOR = '#2a4a30'


def _apply_dark_theme(fig, ax):
    fig.set_facecolor(_BG_COLOR)
    ax.set_facecolor(_BG_COLOR)
    ax.tick_params(colors=_TEXT_COLOR, labelsize=9)
    ax.xaxis.label.set_color(_TEXT_COLOR)
    ax.yaxis.label.set_color(_TEXT_COLOR)
    ax.title.set_color(_TEXT_COLOR)
    for spine in ax.spines.values():
        spine.set_color(_GRID_COLOR)


def render_heatmap(history, hand_type='hard', width=900, height=500):
    """Render error-rate heatmap as PNG bytes.

    hand_type: 'hard', 'soft', or 'pair'
    """
    df = _history_to_df(history)
    df = df[df['dealer_col'] != '']

    if hand_type == 'hard':
        rows = HARD_ROWS
        sub = df[df['type'] == 'hard']
        row_labels = [str(r) for r in rows]
        title = "Hard Totals — Error Rate %"
    elif hand_type == 'soft':
        rows = SOFT_ROWS
        sub = df[df['type'] == 'soft']
        row_labels = [f"A+{r - 11}" for r in rows]
        title = "Soft Totals — Error Rate %"
    else:
        rows = PAIR_ROWS
        sub = df[df['type'] == 'pair']
        row_labels = [f"{r},{r}" for r in rows]
        title = "Pairs — Error Rate %"

    # Build error rate matrix
    matrix = np.full((len(rows), len(DEALER_COLS)), np.nan)
    for r_idx, row_key in enumerate(rows):
        if hand_type == 'pair':
            # For pairs, match by player_val
            pair_val_map = {'A': 12, '10': 20, '9': 18, '8': 16, '7': 14,
                            '6': 12, '5': 10, '4': 8, '3': 6, '2': 4}
            pv = pair_val_map.get(row_key, 0)
            row_data = sub[sub['player_val'] == pv]
        else:
            row_data = sub[sub['player_val'] == row_key]

        for c_idx, col in enumerate(DEALER_COLS):
            cell = row_data[row_data['dealer_col'] == col]
            if len(cell) > 0:
                matrix[r_idx, c_idx] = (1 - cell['correct'].mean()) * 100

    # Create figure
    dpi = 100
    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    _apply_dark_theme(fig, ax)

    # Custom colormap: green (0%) → yellow → red (100%), gray for NaN
    cmap = mcolors.LinearSegmentedColormap.from_list(
        'error', ['#1e8c1e', '#4caf50', '#c8c828', '#e07820', '#d03030'],
    )
    cmap.set_bad(color='#333333')

    masked = np.ma.masked_invalid(matrix)
    im = ax.imshow(masked, cmap=cmap, aspect='auto', vmin=0, vmax=80,
                    interpolation='nearest')

    ax.set_xticks(range(len(DEALER_COLS)))
    ax.set_xticklabels(DEALER_COLS, fontsize=10)
    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels(row_labels, fontsize=9)
    ax.set_xlabel("Dealer Up Card", fontsize=11)
    ax.set_title(title, fontsize=14, fontweight='bold', pad=10)

    # Annotate cells
    for r in range(len(rows)):
        for c in range(len(DEALER_COLS)):
            val = matrix[r, c]
            if np.isnan(val):
                ax.text(c, r, '·', ha='center', va='center',
                        color='#666666', fontsize=10)
            else:
                txt_color = 'white' if val > 40 else '#111111'
                ax.text(c, r, f'{val:.0f}', ha='center', va='center',
                        color=txt_color, fontsize=9, fontweight='bold')

    cbar = fig.colorbar(im, ax=ax, shrink=0.8, pad=0.02)
    cbar.set_label('Error %', color=_TEXT_COLOR, fontsize=10)
    cbar.ax.tick_params(colors=_TEXT_COLOR, labelsize=8)

    fig.tight_layout()
    return _fig_to_png_bytes(fig, dpi)


def render_trend(history, window=20, width=900, height=450):
    """Render rolling accuracy line chart as PNG bytes."""
    df = _history_to_df(history)
    if len(df) < window:
        # Not enough data — render a placeholder
        dpi = 100
        fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
        _apply_dark_theme(fig, ax)
        ax.text(0.5, 0.5, f'Need at least {window} hands for trend',
                ha='center', va='center', transform=ax.transAxes,
                color=_TEXT_COLOR, fontsize=16)
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        fig.tight_layout()
        return _fig_to_png_bytes(fig, dpi)

    df['rolling_acc'] = df['correct'].rolling(window=window, min_periods=window).mean() * 100
    valid = df.dropna(subset=['rolling_acc'])

    dpi = 100
    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    _apply_dark_theme(fig, ax)

    x = np.arange(len(valid))
    y = valid['rolling_acc'].values

    # Color segments by performance
    for i in range(1, len(x)):
        color = '#32c832' if y[i] >= 90 else '#c8c828' if y[i] >= 75 else '#c84040'
        ax.plot(x[i - 1:i + 1], y[i - 1:i + 1], color=color, linewidth=2)

    # Reference lines
    ax.axhline(y=80, color='#448844', linewidth=1, linestyle='--', alpha=0.6, label='80% target')
    ax.axhline(y=95, color='#226622', linewidth=1, linestyle=':', alpha=0.4, label='95% target')

    ax.set_ylim(0, 105)
    ax.set_xlabel('Hand #', fontsize=11)
    ax.set_ylabel('Accuracy %', fontsize=11)
    ax.set_title(f'Rolling {window}-Hand Accuracy', fontsize=14, fontweight='bold')
    ax.legend(loc='lower right', fontsize=9, facecolor=_BG_COLOR, edgecolor=_GRID_COLOR,
              labelcolor=_TEXT_COLOR)
    ax.grid(True, color=_GRID_COLOR, alpha=0.5, linewidth=0.5)

    fig.tight_layout()
    return _fig_to_png_bytes(fig, dpi)


# =========================================================================
# Plotly interactive HTML report
# =========================================================================

def generate_plotly_report(history):
    """Generate a full interactive HTML report and open in browser."""
    df = _history_to_df(history)
    if len(df) == 0:
        return

    # Create subplots
    fig = make_subplots(
        rows=3, cols=2,
        subplot_titles=(
            'Rolling 20-Hand Accuracy', 'Accuracy by Hand Type',
            'Hard Totals Heatmap', 'Soft Totals Heatmap',
            'Pairs Heatmap', 'Error Distribution by Dealer Up Card',
        ),
        specs=[
            [{'type': 'xy'}, {'type': 'xy'}],
            [{'type': 'heatmap'}, {'type': 'heatmap'}],
            [{'type': 'heatmap'}, {'type': 'xy'}],
        ],
        vertical_spacing=0.08,
        horizontal_spacing=0.08,
    )

    # 1. Rolling accuracy line
    if len(df) >= 20:
        df['rolling'] = df['correct'].rolling(20).mean() * 100
        fig.add_trace(go.Scatter(
            x=list(range(len(df))), y=df['rolling'],
            mode='lines', name='Rolling 20',
            line=dict(color='#4CAF50', width=2),
        ), row=1, col=1)
        fig.add_hline(y=80, line_dash='dash', line_color='gray',
                       annotation_text='80%', row=1, col=1)

    # 2. Accuracy by type (bar)
    type_data = []
    for ht in ('hard', 'soft', 'pair'):
        sub = df[df['type'] == ht]
        if len(sub) > 0:
            type_data.append({
                'type': ht.capitalize(),
                'accuracy': sub['correct'].mean() * 100,
                'count': len(sub),
            })
    if type_data:
        tdf = pd.DataFrame(type_data)
        colors = ['#4CAF50' if a >= 80 else '#FFC107' if a >= 60 else '#F44336'
                  for a in tdf['accuracy']]
        fig.add_trace(go.Bar(
            x=tdf['type'], y=tdf['accuracy'], name='By Type',
            marker_color=colors,
            text=[f"{a:.1f}% (n={c})" for a, c in zip(tdf['accuracy'], tdf['count'])],
            textposition='outside',
        ), row=1, col=2)

    # 3-5. Heatmaps
    for idx, (ht, rows, label_fn, r, c) in enumerate([
        ('hard', HARD_ROWS, str, 2, 1),
        ('soft', SOFT_ROWS, lambda x: f"A+{x-11}", 2, 2),
        ('pair', PAIR_ROWS, lambda x: f"{x},{x}", 3, 1),
    ]):
        sub = df[(df['type'] == ht) & (df['dealer_col'] != '')]
        matrix = np.full((len(rows), len(DEALER_COLS)), np.nan)
        for r_idx, row_key in enumerate(rows):
            if ht == 'pair':
                pvm = {'A': 12, '10': 20, '9': 18, '8': 16, '7': 14,
                       '6': 12, '5': 10, '4': 8, '3': 6, '2': 4}
                pv = pvm.get(row_key, 0)
                rd = sub[sub['player_val'] == pv]
            else:
                rd = sub[sub['player_val'] == row_key]
            for c_idx, col in enumerate(DEALER_COLS):
                cell = rd[rd['dealer_col'] == col]
                if len(cell) > 0:
                    matrix[r_idx, c_idx] = (1 - cell['correct'].mean()) * 100

        row_labels = [str(label_fn(rk)) for rk in rows]
        fig.add_trace(go.Heatmap(
            z=matrix, x=DEALER_COLS, y=row_labels,
            colorscale=[[0, '#1e8c1e'], [0.3, '#c8c828'], [0.6, '#e07820'], [1, '#d03030']],
            zmin=0, zmax=80,
            text=np.where(np.isnan(matrix), '·', matrix.astype(int).astype(str)),
            texttemplate='%{text}', textfont={'size': 10},
            showscale=(idx == 0),
            colorbar=dict(title='Error %') if idx == 0 else None,
        ), row=r, col=c)

    # 6. Errors by dealer up card
    errors_by_dealer = df[~df['correct']].groupby('dealer_col').size()
    total_by_dealer = df.groupby('dealer_col').size()
    error_rate = (errors_by_dealer / total_by_dealer * 100).reindex(DEALER_COLS).fillna(0)
    fig.add_trace(go.Bar(
        x=DEALER_COLS, y=error_rate.values, name='Error % by Dealer',
        marker_color='#e07820',
    ), row=3, col=2)

    fig.update_layout(
        height=1200, width=1100,
        template='plotly_dark',
        title_text='Blackjack Strategy Trainer — Performance Report',
        showlegend=False,
    )

    # Write and open
    tmp = os.path.join(tempfile.gettempdir(), 'blackjack_stats_report.html')
    fig.write_html(tmp, auto_open=False)
    webbrowser.open(f'file://{tmp}')
