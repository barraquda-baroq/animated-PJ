#!/usr/bin/env bash
# Render one still per STEP seconds across [FROM, TO) and build labelled contact sheets.
# usage: render/review_sheets.sh <out_dir> [step=1.0] [from=0] [to=180]
set -e
OUT="$1"; STEP="${2:-1.0}"; FROM="${3:-0}"; TO="${4:-180}"
mkdir -p "$OUT/frames"
TIMES=$(python3 -c "import numpy as np; print(','.join(f'{t:.2f}' for t in np.arange($FROM+0.5*$STEP, $TO, $STEP)))")
node "$(dirname "$0")/still.cjs" --times "$TIMES" --out "$OUT/frames" 2>&1 | grep -E "ERROR|PAGE" | head -20 || true
python3 "$(dirname "$0")/../tools/contact_sheet.py" "$OUT/frames" "$OUT/sheet" 6 5 480
