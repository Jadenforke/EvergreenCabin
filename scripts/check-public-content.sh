#!/usr/bin/env bash
# Pre-publish content check for the investor presentation site (spec §7.3, layer 3).
#
# The sourcing catalog (index.html, site-planner.html) is an internal procurement
# tool and is *expected* to carry manufacturer names, prices, freight and HS codes.
# The investor page must carry none of it. This script guards only the investor
# page and the assets it ships.
#
# Any hit is a build failure.

set -uo pipefail
cd "$(dirname "$0")/.."

TARGET="presentation.html"
ASSET_DIR="assets"
fail=0

# Blocked terms, per §7.3. Case-insensitive, extended regex.
BLOCKED=(
  'meihua' 'zhongjun' 'platinum' 'weizhengheng' 'yidongxiang' 'foshan'
  'qianyan' 'yuntu' 'allrun' 'huijue' 'borealkits' 'batiscan' 'bonneville'
  '\bEXW\b' '\bFOB\b' '\bCIF\b' '\bUSD\b' '\bCAD ?\$' 'HS ?code' 'HS ?9[0-9]{3}'
  'surtax' 'quotation' 'kN/m' 'incoterm' 'landed cost' 'lead ?time'
  '\$[0-9]' 'per sq ?ft' 'price' 'pricing' 'deposit'
)

if [ ! -f "$TARGET" ]; then
  echo "check-public-content: $TARGET not found" >&2
  exit 1
fi

echo "Checking $TARGET against the §7.3 blocked-term list…"
for term in "${BLOCKED[@]}"; do
  if hits=$(grep -nEi -- "$term" "$TARGET"); then
    echo "BLOCKED TERM: /$term/" >&2
    echo "$hits" | sed 's/^/    /' >&2
    fail=1
  fi
done

# Asset hygiene: no quote PDFs, material lists or supplier-named files may ship
# in the investor asset tree.
if [ -d "$ASSET_DIR" ]; then
  echo "Checking $ASSET_DIR filenames…"
  if bad=$(find "$ASSET_DIR" -type f \
        \( -iname '*.pdf' -o -iname '*quot*' -o -iname '*material*' \
           -o -iname '*invoice*' -o -iname '*packing*' -o -iname '*spec*sheet*' \) ); then
    if [ -n "$bad" ]; then
      echo "BLOCKED ASSET(S):" >&2
      echo "$bad" | sed 's/^/    /' >&2
      fail=1
    fi
  fi
fi

# Every /assets/ path the page references must actually exist.
echo "Checking referenced assets resolve…"
while read -r path; do
  [ -z "$path" ] && continue
  if [ ! -f ".${path}" ]; then
    echo "MISSING ASSET: $path" >&2
    fail=1
  fi
done < <(grep -oE '/assets/[A-Za-z0-9./_-]+' "$TARGET" | sort -u)

# The gated numbers route must not come back (§9.1).
if grep -nE '#/numbers|numbersPage|passwordGate' "$TARGET"; then
  echo "BLOCKED: a numbers/gated route appears in $TARGET" >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "FAILED — investor page carries content the public site must not show." >&2
  exit 1
fi
echo "OK — no blocked terms, no blocked assets, all asset paths resolve."
