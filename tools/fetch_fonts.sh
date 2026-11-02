#!/usr/bin/env bash
# Download the OFL fonts used by the PV (Shippori Mincho, Zen Old Mincho, Cormorant Garamond).
set -e
cd "$(dirname "$0")/../pv/fonts"
B=https://raw.githubusercontent.com/google/fonts/main/ofl
for f in shipporimincho/ShipporiMincho-Regular.ttf shipporimincho/ShipporiMincho-Medium.ttf shipporimincho/ShipporiMincho-SemiBold.ttf \
         shipporimincho/ShipporiMincho-Bold.ttf shipporimincho/ShipporiMincho-ExtraBold.ttf zenoldmincho/ZenOldMincho-Regular.ttf \
         zenoldmincho/ZenOldMincho-Bold.ttf zenoldmincho/ZenOldMincho-Black.ttf; do curl -sSf -O "$B/$f"; done
curl -sSf -o CormorantGaramond.ttf "$B/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
curl -sSf -o CormorantGaramond-Italic.ttf "$B/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf"
echo "fonts ready"
