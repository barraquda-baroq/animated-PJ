# 背景美術ライブラリ API — `pv/engine/lib/atmos.js`（PV.lib）

劇場アニメ背景（光と空気）用の Canvas2D ライブラリ。すべて決定論的（`t` と `seed` だけで決まる）。
座標は 1920×1080 のキャンバス座標（y は下向き）。角度はラジアンで、0 は右、`-Math.PI/2` は上。
重い静的絵（雲・海の下地・帯雲・嵐の雲・スカイライン・病室の遠景・木漏れ日の投影）は初回だけ描いてキャッシュする。2 フレーム目以降は `drawImage` と小さなストロークだけになる。

- ショーケース: `pv/scenes/_dev_bg.js`（`dev_bg_1`〜`dev_bg_8`）。各カットの組み方はこのファイルをそのまま手本にしてよい。
- 美術監督の講評と修正記録: `analysis/art_review/bg_critique.md`

## 最終画像（`analysis/art_review/bg_review/final/`）

| 画像 | パス |
|---|---|
| 8 カット一覧（t=4 / t=0） | `final/overview_t4.00.jpg`, `final/overview_t0.00.jpg` |
| 各カット（t=0, 2, 4） | `final/dev_bg_{1..8}_{0.00,2.00,4.00}.jpg` |
| 各カットの時間変化 | `final/sheet_dev_bg_{1..8}.jpg` |
| 旧テストシーン（互換確認） | `final_compat/compat_legacy.jpg` |
| 他エージェントのショーケース（互換確認） | `final_compat/compat_others.jpg` |
| 受け取り時点（比較用） | `bg_review/r0/`、さらに前の版は `bg_base/` |

カット: 1 春の青空と積雲 / 2 夏の海・入道雲（かなとこ雲）・白い大橋 / 3 夜の臨海公園（夜景・観覧車・夜の橋・水面）/ 4 嵐の橋（t=0 暗、t=4 雷光）/ 5 病室の窓外 / 6 中庭の木漏れ日 / 7 三日月の夜 / 8 夕焼けの海と橋

---

## 互換性

旧関数（`sky, cloudSprite, clouds, haze, glow, godRays, dust, bokeh, flare, rain, splashes, lightningPath, lightning, petals, sea, bridge, skyline, stars, noteShape, noteStorm, paper, blurred`）は、引数をすべて以前どおり受け付ける。オプションは追加しただけで、既存の名前と意味は変えていない。旧呼び出しは**配置そのまま、見た目だけ新しく**なる。

**配置と色の互換（今回の監督修正で直した点）**
- `L.clouds` の流れと折り返しは、オリジナルのライブラリと同じ式に戻した。乱数の消費順も同じなので、旧呼び出しの雲は元の位置に出る。
- 旧 API の暗い色指定（`colors:{lit:'#5a6b8f', mid:'#3a4766', shadow:'#151c30'}` など、嵐の雲）は暗いまま描く。ハイライトもリムも指定色から作るので、月夜の白い雲にならない。平均色はオリジナルとほぼ同じ。
- `L.bridge` に暗い `color` を渡したとき（嵐のシルエット）は、影側をより暗くする。明るい青に寄せない。
- `L.bridge` の主塔の既定は**1 本柱**（側面図として正しい形）。二本脚は `style:'H'`、逆 Y 字は `style:'Y'`。
- `L.clouds` は呼び出し側の `globalAlpha` を掛け合わせ、ctx の状態を必ず元に戻す。以前は 1 に戻していた。

**振る舞いの変化（知っておくこと）**
- `L.bridge` / `L.skyline` / `L.ferrisWheel` は灯りの配列 `[{x,w,c,a}]` を返す（水面の映り込み用）。旧呼び出しは戻り値を無視するので影響しない。
- `L.sea` の `sparkles` は「強い星形グリントの数」になった（既定 260）。きらめきの大部分は、別の光の道レイヤー（数千の横きらめき）が担う。
- `L.sea` は近景に白波を描く（パレット既定: summer 0.45、spring・autumn 0.35、storm 0.6、sunset 0.12、night 0）。消すときは `crests:0`。
- `L.skyline` は `lit` を渡すと、足元に遠い街灯の光の帯（`carpet`）を描く。不要なら `carpet:0`。
- `L.noteStorm({count:0})` は何も描かない（以前は誤って 260 個描いていた）。
- `L.lightning` は `shadowBlur` を使わない（約 5 秒 → 約 15ms）。
- `L.foliage` の `blur` は、低解像度で描いて拡大する「ピンぼけ」方式になった（CSS の blur フィルタより約 3 倍速い）。`blur` が 4 を超えると、さらに本物のぼかしを足す。

---

## キャッシュと「毎フレーム動かしてよい引数」

**原則**: スプライトを作る引数（形・色・光の向き・霞・サイズ）は**カットの中で一定**にする。値ごとに新しい絵が描かれ、重くなるうえメモリも増える。位置・時間・不透明度・拡大率は自由に動かしてよい。

| 関数 | 毎フレーム動かしてよい | 一定にすべき（キャッシュの鍵） |
|---|---|---|
| `skyDome` | なし（全オプションで LRU 14 枚） | 全部。太陽を動かすなら `sun` は渡さず `L.sun` を別に呼ぶ |
| `cloudSprite` / `clouds` / `cumulonimbus` | 位置、`t`、`speed`、`alpha`、`scale`、`x0`/`x1`、`drift` | `w`・`h`（`clouds` なら `minW`/`maxW`/`aspect`）、`seed`、`type`、`palette`/色、`light`、`lightZ`、`haze`、`fade`、`anvil` |
| `cloudBand` | `x`、`y`、`t`、`speed`、`alpha`、`morph` | `kind`、`w`、`h`、`seed`、`coverage`、`scaleX`/`scaleY`、色、`light`、`cell`、`perspective` |
| `stormClouds` | `y`、`t`、`speed`、`flash`、`flashX`/`flashY`/`flashR`、`alpha`、`scud` | `h`、`seed`、`base`、`cells`、`colors` |
| `sea` | `horizonY`、`y1`（ティルト可）、`sunX`、`sunY`、`road`、`shimmer`、`wobble`、`swell`、`crests`、`t` | `palette`/`stops`、`seed`、`chop`。`roadWidth` は 0.1 刻みでキャッシュされるので、ほぼ一定にする |
| `nightWater` | `horizonY`、`y1`、灯りの位置（パンには `dx`）、灯りの明るさ、`t` | 灯りの色（20 段階に量子化されるので、少し変える程度は可） |
| `bridge` / `ferrisWheel` / `wires` / `moon` / `sun` | 全部（キャッシュなし） | — |
| `skyline` | `y`（パララックス・ティルト）、`t` | 他の全オプション（24 枚の LRU） |
| `foliage` | `x`、`y`、`angle`、`wind`、`back`、`shade`、`blur`、`t` | `seed`、`length`、`depth`、`density`、`leaf`、`colors`、`width`、`cluster` |
| `canopy` | `t`、`wind`。`sun` はゆっくりなら可（24px ごとに描き直す。6 枚の LRU） | `seed`、範囲、`rag`、`density`、`leaf`、`colors` |
| `komorebi` | 範囲（64px 単位でキャッシュ）、`strength`、`shade`、`wind`、`t` | `color`、`seed`、`density`、`perspective`、`scale`、`flat` |
| `hospitalView` | `x`/`y`/`w`/`h`、`t`、`wind`、`leafBlur` | `seed`、`bridge`、`bridgeX` |
| `dust` / `bokeh` / `godRays` / `stars` / `flare` | 全部 | 色の文字列（色ごとに小さなスプライトを作るので、連続的に変える場合は数段階に丸める） |

**初回コスト**: 雲を多く使うカットは、最初のフレームでキャッシュ生成に 0.5〜2.5 秒かかる。動画書き出しではワーカーごとに 1 回だけ。

---

## 処理コスト（ヘッドレス Chromium、単一プロセス、ラスタライズ込み）

`steady` は 2 フレーム目以降（目安 40ms 以内）。`first` はキャッシュ生成込みの初回。

| 関数 | steady | first |
|---|---|---|
| skyDome | 1.0ms | 44ms |
| clouds ×6 | 6.4ms | 0.9s |
| cumulonimbus 1180×720 | 0.5ms | 0.8s |
| ＋anvil | 0.4ms | 0.19s |
| cloudBand cirrus | 2.5ms | 0.13s |
| cloudBand mackerel | 4.0ms | 0.47s |
| mackerel `morph:1` | 7.9ms | 1.0s |
| stormClouds | 17.5ms | 1.2s |
| stormClouds 雷光中 | 29.5ms | — |
| rainCurtain ×7 | 10.8ms | 33ms |
| rain 700 本 | 4.8ms | 6ms |
| lightning | 14.1ms | 17ms |
| sea（夏） | 16.8ms | 0.13s |
| sea（嵐） | 6.9ms | 73ms |
| nightWater | 10.3ms | 92ms |
| bridge（夜） | 1.1ms | 3ms |
| skyline | 0.4ms | 42ms |
| ferrisWheel（夜） | 2.7ms | 4ms |
| stars 260 | 1.3ms | 2ms |
| moon | 3.4ms | 4ms |
| godRays | 12.1ms | 14ms |
| komorebi（地面） | 21.9ms | 64ms |
| komorebi（壁） | 19.8ms | 49ms |
| canopy | 11.1ms | 78ms |
| foliage | 22.5ms | 32ms |
| foliage `blur` | 16.1ms | 19ms |
| hospitalView | 22.5ms | 0.55s |
| sunset | 19.4ms | 0.55s |
| flare / bokeh 40 / dust 90 / petals 40 / haze / wires | 0.4〜2ms | — |

**ショーケース 1 カット全体**（steady、ポスト処理は除く）

| カット | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| ms | 10 | 23 | 56 | 66 | 31 | 68 | 14 | 39 |

いずれもカットの目安 80ms 以内。

---

## 空

### `L.sky(ctx, stops, y0=0, y1=H)`（旧）
縦グラデーションで全画面を塗る。`stops` は `[[pos,'#hex'],...]`。

### `L.skyDome(ctx, t, o)`
描き込まれた空。天頂→地平線のグラデーション、ごく低周波の色むら（絵の具の揺らぎ）、地平線の霞、太陽の順に描く。

| オプション | 既定・内容 |
|---|---|
| `preset` | `'spring'`（既定）`'summer'` `'autumn'` `'sunset'` `'dusk'` `'dawn'` `'night'` `'city'`（街明かりで赤紫に濁る夜）`'storm'` `'overcast'` |
| `stops` | 独自のグラデーション（0=上端、1=地平線） |
| `horizon` | 地平線の y、既定 0.7H。これより下は霞の色で塗る |
| `top`, `x0`, `x1`, `y1` | 塗る範囲 |
| `haze`, `hazeColor`, `hazeH` | 地平線の霞（強さ 0..1、色、高さ） |
| `sun` | `{x, y, scale, intensity, rays, halo, color, glow}`（`L.sun` と同じ） |
| `texture`, `textureAmt`, `seed` | 色むら |
| `cache` | `false` で毎フレーム直描き |

### `L.sun(ctx, x, y, o)`
太陽。描く順は次のとおり。
1. 広い散乱光
2. コロナ
3. 光輪（淡い虹色のリング）
4. ゆっくり回る細い光芒
5. 白飛びした円盤

オプション: `scale`(1) `intensity`(1) `color` `glow` `halo`(true) `haloR`(330) `haloAmt` `rays`(0.55) `t` `disc`(true) `seed`

y を負（画面外）に置くと「上から差す強い日差し」になる。

### `L.moon(ctx, o)`
月。既定は三日月。

| オプション | 既定・内容 |
|---|---|
| `x`, `y`, `r` | 1440, 230, 44（推奨 40〜70） |
| `phase` | 照らされた割合。0.18=三日月、0.5=半月、1=満月 |
| `tilt` | 光る縁の向き。既定 -0.55 |
| `earthshine` | 暗部の見え方。既定 0.05（ほぼ見えない。惑星のように見えないため） |
| `halo` | 月暈 0..1 |
| その他 | `color` `glow` `intensity` `texture` |

---

## 雲

### `L.cloudSprite(key, o)` → canvas
`(w+120)×(h+120)` のスプライトを返す（周囲 60px は透明）。雲底は y=60+h。

**形の作り方**: フラクタルな「もこもこ」球群を、高さ場・法線場に統合する。

**塗り方（アニメ背景の塗り）**: 光・半陰・陰の 3 つの面を、筆でゆらいだ細い境界で塗り分ける。
- もこもこの陰側は、くっきりした三日月形の影になる。
- 谷はスカラップ（波形）の線になる。
- 光の面は静かに保ち、白〜わずかに暖色にする。
- 影は空を映した澄んだ青、谷は群青。
- 陰側の輪郭は空の色を帯びて薄くなる（空気に溶ける）。
- 逆光では大きな形の陰影が優先され、薄い縁だけが銀色に光る。

| オプション | 内容 |
|---|---|
| `w`, `h`, `seed` | サイズ（既定 600×260）とシード |
| `type` | `'cumulus'` 春の積雲 / `'tower'` 入道雲 / `'puff'` 小さな綿雲 / `'flat'` 層積雲 / `'storm'` ちぎれた暗雲 |
| `palette` | `'day'` `'spring'` `'summer'` `'autumn'` `'sunset'` `'sunsetHigh'` `'dusk'` `'storm'` `'night'` `'overcast'`（`L.CLOUD_PAL`） |
| 個別色 | `lit` `mid` `shadow` `hi` `deep` `bounce` `rim` `hazeColor` `sky`。旧 `colors{lit,mid,shadow,rim}` もそのまま使える |
| `light` | 光の来る 2D 方向。既定 -2.2（左上） |
| `lightZ` | 正 = 順光、負 = 逆光。既定 0.5 |
| `haze` | 大気遠近 0..1 |
| `fade` | 下側のこの割合が地平の霞に溶ける |
| 塗りの調整 | `paint`（0..1。0 で旧来の滑らかな 3D 陰影）`th1` `th2`（陰/半陰、半陰/光の境界）`edgeSoft`（境界の幅）`air` |
| 形・陰の調整 | `cast` `ao` `sharp` `macro` `levels` `soft` `ragged` `baseDark` `lift` |

### `L.clouds(ctx, t, o)`
流れる雲の群れ。小さい雲（遠い雲）から順に描く。

| オプション | 内容 |
|---|---|
| 旧オプション | `seed`(7) `count`(6) `y0`(80) `y1`(500)（スプライト上端の範囲）`minW`(300) `maxW`(900) `speed`(6) `alpha` `colors` `scale` |
| `type`, `palette`, `light`, `lightZ` | `cloudSprite` と同じ |
| `aspect` | `[min,max]`（h/w） |
| `sun` | `{x,y}` を渡すと、雲ごとに太陽の方向から照らす。太陽に近い雲は自動で逆光になる |
| `horizon`, `hazeK` | 地平線に近い雲ほど霞む |
| `x0`, `x1` | この範囲の中で流れて折り返す |

推奨サイズ: 近景の積雲は w 500〜1000、遠景は 150〜360（`type:'puff'`）。

### `L.cumulonimbus(ctx, t, o)`
入道雲。水平線に立つ巨大な塔。

| オプション | 既定・内容 |
|---|---|
| `x`, `base` | 中心の x、雲底の y（水平線より少し下にすると霞に沈む） |
| `w`, `h` | 1100×760。**頂部を画面に入れること**。base−h が 0 より下に来るように |
| `seed`, `palette` | `palette` の既定は `'summer'` |
| `light`, `lightZ` | -2.3 / 0.5（劇的にするなら -2.75 / 0.3） |
| `haze`, `fade` | `fade` 既定 0.3 |
| `drift` | px/s |
| `anvil` | 0..1。成熟した雷雲のかなとこ雲（平らに広がる頂部の棚）。遠景に 0.8〜1 を置くと夏の不穏さが出る |
| `anvilDir` | かなとこが伸びる方向。1 で右 |
| その他 | `scale` `alpha` `type`（`'cumulus'` にすると横長の雲塊） |

### `L.cloudBand(ctx, t, o)`
ノイズで描く雲の帯。矩形 `x,y,w,h` に描き、x 方向に継ぎ目なく流れる。

| `kind` | 見た目 |
|---|---|
| `'streak'` | 層状の雲の筋。夕焼けでは `light:Math.PI/2` で下から照らす |
| `'cirrus'` | 刷毛で掃いた羽毛状の巻雲（斑＋櫛でといた繊維） |
| `'deck'` | 上が厚い層雲 |
| `'mackerel'` | うろこ雲 / ひつじ雲。日の当たる上面と青灰の下面を持つ小さな雲片が、遠近つきの波打つ列に並ぶ |

| オプション | 内容 |
|---|---|
| 共通 | `seed` `coverage`(0.5) `softness` `scaleX` `scaleY` `palette`/色 `light` `gain`(1.5) `base`(0.6) `thick` `res` `speed`(4) `alpha` `mode` |
| mackerel 用 | `cell`(26) `perspective`(0.78) `alphaK`(0.92) `res`(0.7) |
| mackerel の `morph` | 雲片がゆっくり形を変える（2 状態のクロスフェード）。初回 +0.5 秒 |

### `L.stormClouds(ctx, t, o)`
嵐の空。2 つの層でできている。
- **遠い天井**: ノイズで描いた霞んだ雲の天井。
- **嵐のセル**: その下に並ぶ暗い雲の塊。積雲と同じ塗りなので、本物のカリフラワーの量感がある。セルは天井の下から湧き出して見え、パララックスで流れる。

雷光（`flash`）を渡すと、同じ形の「内側から照らされた版」を閃光点の周りだけクロスフェードする。

| オプション | 既定・内容 |
|---|---|
| `y`, `h` | 0, 640 |
| `base` | セルの雲底の位置 0..1、既定 0.78 |
| `cells` | 4 |
| `seed` | — |
| `speed` | 14px/s（セル。天井はその 35%） |
| `scud` | true（低く速く流れるちぎれ雲） |
| `flash` | 0..1。`L.flashCurve` の値を渡す |
| `flashX`, `flashY`, `flashR` | 閃光の中心と半径。R の既定は 760 |
| `colors` | `{top,dark,mid,light,edge,haze,fl,flMid,flDark}` |
| `alpha` | — |

### `L.haze(ctx, t, o)`（旧）
薄い霞の筋。

---

## 光

| 関数 | 内容 |
|---|---|
| `L.glow(ctx, x, y, r, color, a, mode)` | 放射状の発光（旧） |
| `L.godRays(ctx, t, o)` | 光芒。1/4 解像度で描いてからぼかすので、輪郭が自然に柔らかい。オプション: `x` `y` `angle` `spread` `count` `length` `width` `flare` `color` `alpha` `seed` `jitter` `flicker` `mode` `blur` |
| `L.dust(ctx, t, o)` | 光の中の塵。`mask(x,y)` で範囲を限定できる |
| `L.bokeh(ctx, t, o)` | 縁が少し明るいボケ円盤。夜景のボケには `mode:'lighter'`、彩度の高い暗めの色（`'#c8701c'` `'#c2456e'` `'#d0a246'` `'#5a86c8'`）、`alpha` 0.3〜0.4。**前景のボケは画面下端・手前に置く**（空に浮かべると風船に見える） |
| `L.flare(ctx, x, y, k, color)` | レンズフレア |

---

## 天候

| 関数 | 内容 |
|---|---|
| `L.rain(ctx, t, o)` | 雨の筋（旧） |
| `L.rainCurtain(ctx, t, o)` | 嵐の雲の下に垂れる雨の幕。オプション: `x0` `x1` `y0` `y1` `count`(5) `angle`(0.12) `speed`(900) `drift`(18) `color` `alpha`(0.35) `seed` |
| `L.splashes(ctx, t, o)` | 着水・着地。遠近で大きさが変わる細いリング＋最初の一瞬だけ立つ小さな水柱。オプション: `x0` `x1` `y0` `y1` `count` `color` `alpha`(0.55) |
| `L.lightningPath(seed, x0, y0, x1, y1, rough, depth)` / `L.lightning(ctx, segs, strength, color)` | 稲妻。**雲の底から**落とす（始点の y を雲底に置く） |
| `L.flashCurve(t, strikes, o)` → 0..1 | 雷光の強さ。主放電 → 再発光 → 余韻の 3 段フリッカー。`o.decay` 既定 0.45 |
| `L.petals(ctx, t, o)` | 桜の花びら（旧） |

**雷光の組み方（dev_bg_4）**
1. `fl = L.flashCurve(t,[0.9,4.0])` で強さを求める。
2. `L.stormClouds({flash:fl, flashX, flashY})` で雲を照らす。
3. `L.lightning(segs, L.flashCurve(t,[s],{decay:0.25}))` で稲妻を描く。
4. `L.rainCurtain({alpha:0.5+0.3*fl})` で雨の幕を明るくする。
5. 橋には `{night:true, flash:fl, rim:'#cfdcff', rimAmt:fl}` を渡す。
6. 最後に全画面へ `rgba(220,232,255,0.28*fl)` を重ねる。

---

## 海と水面

### `L.sea(ctx, t, o)`
海。水面は規定の高さで一度だけ描き、任意の水平線・高さに写像する（**ティルトしても描き直さない**）。

**重ねるもの**
- 描いた波: 暗い谷のレンズ形と、空を映す明るい縁。風の当たる面と凪の面がある。遠くほど密になる。
- 水平線近くの細い反射
- 行ごとの揺らぎ
- 生まれては消えるきらめき
- 光の道: 太陽の下のグロー＋数千の横きらめきを 2 層に分け、行ごとに瞬かせる
- 強い星形グリント
- 近景の白波（巻いた白い唇と泡）
- 手前のうねり

| オプション | 内容 |
|---|---|
| 旧オプション | `horizonY`(560) `y1` `stops` `seed` `sparkle` `sunX` `sparkles`(260) `sparkleAlpha` `sparkleColor` |
| `palette` | `'summer'` `'spring'` `'autumn'` `'sunset'` `'night'` `'storm'`（`L.SEA_PAL`） |
| `sunY` | 太陽が低いほど光の道が強く、細くなる |
| `road`, `roadWidth` | 光の道の強さ（0.55）と幅 |
| `shimmer`, `wobble`, `chop`, `swell` | きらめき、揺らぎ、波の量、手前のうねり |
| `crests` | 白波 0..1（パレット既定） |
| `horizonLine` | 水平線の明るい線 0..1 |

### `L.nightWater(ctx, t, o)`
夜の水面。対岸の灯りが縦に伸び、ちぎれた横棒の連なりになって揺れる。灯りごとにキャッシュした柱を毎フレーム並べるので、**パンしても描き直さない**。

| オプション | 既定・内容 |
|---|---|
| `horizonY`, `y1` | 岸線の y と下端 |
| `lights` | `[{x, w, c:'#hex', a}]`。普通は `L.skyline(...)`・`L.bridge({night:true})`・`L.ferrisWheel({night:true})` の戻り値を `concat` して渡す |
| `len` | 映り込みの長さ（水面の高さに対する割合）。0.85 |
| `wobble` | 1 |
| `glow` | 街明かりの照り返し。0.5 |
| `dx` | 全灯を x 方向にずらす（カメラのパン） |
| `seed` | — |

---

## 構造物

### `L.bridge(ctx, o)` → 灯りの配列
白い斜張橋の側面図。

**各部の描き方**
- 桁: 上面ハイライト、側面、下面の影、下縁の線。白い桁が白い霞から分離して見える。
- 主塔: テーパー付き。光の側と影の側で塗り分ける。
- その他: ファン状のケーブル、主塔の下の橋脚と取り付け部の小橋脚。

**夜（`night:true`）**
- 主塔のライトアップ（`uplight` 0.26）
- 赤い航空障害灯（`t` で点滅）
- 桁の街灯（`lamps`、`lampColor`）

| オプション | 内容 |
|---|---|
| 旧オプション | `x0` `x1` `y`（桁）`towerH`(160) `color` `lw`(3) `alpha` `towers` `pierH`(40) `cables`(9) |
| `style` | `'I'`（既定、側面図の 1 本柱）`'H'`（二本脚、斜めから見た形）`'Y'`（逆 Y 字） |
| `shadow`, `light` | 影側の色、光の向き `'left'`/`'right'` |
| `haze`, `hazeColor` | 遠景の霞 |
| `span` | ケーブルの広がり |
| `flash` | 雷光（ケーブルが光る） |
| `rim`, `rimAmt` | 光の側の縁だけ光らせる（夕日・雷光の逆光） |

**推奨値**
- 遠景: `lw` 2〜2.5、`towerH` 100〜120、`haze` ≤ 0.1。白い橋はモチーフなので霞に溶かしすぎない。
- 中景: `lw` 3.5〜4.5、`towerH` 200〜230。
- 嵐の近景: `lw` 8、`towerH` 420。

**構図の注意**: 桁の端を水の上で途切れさせない。画面外まで伸ばすか、ビルや観覧車の後ろに隠す。

### `L.skyline(ctx, o)`（キャッシュ）→ 灯りの配列
ビル群のシルエット。

**建物の描き込み**
- セットバック、斜めの頂部、塔屋、アンテナ
- ファサードの明暗（空側の明るい縁と、暗い側面）
- 窓明かり: フロア単位の帯、点々と灯る住宅、全点灯のタワー
- 高層ビル頂部の照明帯（`crowns`）
- 足元の遠い街灯の光の帯（`carpet`）
- 航空障害灯
- `style:'town'` で切妻屋根の住宅街になる

キャッシュに y を含めないので、**y を動かしても描き直さない**。

| オプション | 内容 |
|---|---|
| 旧オプション | `seed` `y` `hMin` `hMax` `color` `windowColor` `lit` `x0` `x1` `wMin` `wMax` |
| 窓 | `windowColors[]`、`win:[w,h,gapX,gapY]`（既定 `[3,4,8,9]`） |
| 光 | `glow`（窓の滲み）`rim` `skyGlow`（背後の街明かり） |
| 霞 | `haze`, `hazeColor` |
| その他 | `gap` `style` `carpet` `crowns` `beacons` `t` |

昼の遠景に使うときは `lit` を省き、霞色にする（dev_bg_1、病室の遠景）。

### `L.ferrisWheel(ctx, t, o)` → 灯りの配列
観覧車。臨海公園のランドマーク。
- 昼: 白い鉄骨のシルエット（A 字の脚、外輪、スポーク、吊られたゴンドラ）。
- 夜（`night:true`）: 電飾の外輪とスポーク。色のパターンがゆっくり流れ、ゴンドラの窓が灯る。

| オプション | 既定・内容 |
|---|---|
| `x`, `y` | ハブの位置 |
| `r` | 半径 220 |
| `legH` | 脚の長さ |
| `night`, `t` | 夜の電飾、時刻 |
| `pattern` | `'rainbow'`（既定）`'warm'` `'cool'` |
| `speed` | 回転 0.01rad/s |
| `spokes`, `gondolas` | 32, 32 |
| `color`, `haze`, `hazeColor`, `alpha`, `glow` | — |

**夜の臨海公園の組み方（dev_bg_3）**
遠いビル群 → 橋（桁の端は観覧車とビルの後ろ）→ 観覧車 → 近いビル群 → `nightWater`（`lights` に全部の戻り値を `concat`）→ 手前の柵 → 手前のボケ。

### `L.stars(ctx, t, o)`
星。オプション: `seed` `count` `yMax` `alpha` `x0` `x1` `y0`

### `L.wires(ctx, o)`
電柱と電線のシルエット。オプション: `poles` `y` `h` `color` `lw` `lines` `sag`

---

## 植物と木漏れ日

### `L.foliage(ctx, t, o)`
揺れる枝葉。
- 枝: 先細りで、ゆるく曲がる。
- 葉: 卵形・披針形・丸形の 3 種。2 トーンで、葉脈がある。スプライトとして描く。
- 動き: 重力で垂れ、風で揺れる。

| オプション | 既定・内容 |
|---|---|
| `x`, `y`, `angle` | 根元と伸びる方向 |
| `length`, `width`, `depth` | 420, 14, 5 |
| `density`, `leaf`, `cluster`, `droop` | 葉の量（1）、葉の大きさ（22）、枝先の房の量、垂れ具合（0.1） |
| `colors[]`, `branchColor` | 葉の色、枝の色 |
| `back` | 逆光で透ける量 |
| `shade`, `shadeColor`, `backColor` | 影に沈める量、影の色、透けた時の色 |
| `wind`, `seed` | — |
| `blur` | 手前のピンぼけ。1〜2 で軽く、4 以上で強く |

**枝 1 本の葉は 600 枚程度まで**が目安（多いと 20ms を超える）。葉を大きく、`density` を低めにする方がアニメ背景らしい。

### `L.canopy(ctx, t, o)`
見上げた木々の天蓋。葉房はテンプレートとして一度だけ塗り、層ごとのシートに焼き込む。シート単位で揺れるので、1 フレーム約 11ms。
- 奥の葉: 暗い塊。
- 太陽の近くの手前の葉: 黄緑に透ける。
- 隙間: 空と太陽がのぞき、きらきらとまたたく。

| オプション | 既定・内容 |
|---|---|
| `x0`, `x1`, `y0`, `y1` | 範囲（y1 は下端の平均） |
| `rag` | 下端のギザギザ、160 |
| `density` | 1〜2.2 |
| `leaf` | 24〜30 |
| `sun`, `sunR` | 逆光の中心と半径（700） |
| `glints` | true |
| `wind`, `seed` | — |
| `colors` | `{dark,mid,lit,glow}` |

`L.sun` を先に描き、その上に `canopy` を重ねること。

### `L.komorebi(ctx, t, o)`
木漏れ日。光を受ける物（地面・ベンチ・人物・壁）を描いた**後に**重ねる。

**仕組み**
1. 冷たい青灰の木陰を落とす。
2. 光の模様を作る。くっきりした暖色の日だまり（楕円の太陽像が重なった不規則な形）と、その周りのピンホールの小斑。
3. それを地面の遠近に一度だけ投影してキャッシュする（1px ごとの投影なので継ぎ目がない）。
4. 毎フレーム、投影を風でずらす。
5. 梢の隙間マスクで、光がまだらに当たるようにする。
6. 単独の斑をまたたかせる。

| オプション | 既定・内容 |
|---|---|
| `x0`, `y0`, `x1`, `y1` | 範囲 |
| `perspective` | 0=壁/真上 … 1=強い地面遠近。既定 0.7 |
| `scale` | 模様の大きさ |
| `density` | 0.6 |
| `coverage` | 光の当たる割合 0.6 |
| `color` | `'#ffdf9a'` |
| `strength` | 1 |
| `shade`, `shadeColor` | 0.82, `'#7e88ab'` |
| `count`, `spot` | 単独の斑の数（40）と大きさ（24） |
| `wind`, `seed` | — |
| `flat` | 壁での縦横比 0.72 |
| `res` | 1。0.5 にすると軽いが、斑の縁が粗くなる |

---

## 完成背景

### `L.hospitalView(ctx, t, o)`
病室の窓から見る外。矩形 `x,y,w,h` にクリップし、cover で合わせて描く。

**内容**
- 秋の高い青空とうろこ雲（ゆっくり流れる。`morph` で変形もする）
- 巻雲
- 霞んだ山並みと街
- 湾
- **霞の手前に立つ白い大橋**
- 窓辺の黄葉しかけた枝（軽いピンぼけ）

| オプション | 既定・内容 |
|---|---|
| `x`, `y`, `w`, `h` | 描く矩形 |
| `seed` | — |
| `branches`, `wind`, `leafBlur` | 枝の有無、風、ピンぼけ（≈1.2） |
| `alignX`, `alignY` | 合わせ位置 |
| `bridge`, `bridgeX` | true, 0.36 |
| `mackerel` | うろこ雲の量 0.38 |
| `morph` | 0 |

窓枠・カーテン・室内の壁は呼び出し側で描く（dev_bg_5）。

### `L.sunset(ctx, t, o)`
夕焼け空の完成形。
- 天頂は群青。藍→藤→くすんだ薔薇→橙→金と下りる。
- 低い太陽
- 下から照らされた高層の筋雲
- 夕日色の積雲（胴は紫、太陽側の縁が金）
- 水平線近くの暗い筋雲
- 薄明光線

オプション: `horizon`(0.66H) `sunX` `sunY` `seed` `preset`（`'sunset'`/`'dusk'`）`cumulus` `rays`

海と組み合わせるなら `L.sea({palette:'sunset', sunX, sunY, road:0.9})`。橋は暗い `color` ＋ `rim:'#ffb977'` ＋ `light:'right'`（太陽の側）。

---

## その他（旧）
- `L.noteShape(ctx, s, kind)`, `L.noteStorm(ctx, t, o)`: 音符の嵐
- `L.paper(ctx, alpha, seed)`: 紙の質感のオーバーレイ
- `L.blurred(ctx, px, fn, key)`: 被写界深度風のぼかし

## 定数
`L.SKY`（空）、`L.CLOUD_PAL`（雲）、`L.SEA_PAL`（海）のプリセット。色を作るときの参照用。

---

## シーン別レシピ（色彩設計との対応）

| 場面 | 組み方 |
|---|---|
| 春の音楽室の窓外・中庭の青空 | `skyDome{preset:'spring'}`, `clouds{palette:'spring', sun, horizon}`, `cloudBand{kind:'cirrus'}`, `petals`。中庭は dev_bg_6 の順（建物 → 地面 → `komorebi` 地面と壁 → `sun` → `canopy` → `dust`） |
| 雨の音楽室（窓の外） | `skyDome{preset:'overcast'}`, `cloudBand{kind:'deck', palette:'overcast'}`, `rain`, `rainCurtain`, 遠景は `skyline`（`lit` 少なめ、霞色） |
| 夏の海 | dev_bg_2。`skyDome{preset:'summer', sun:{y:-70}}`, `cumulonimbus`（主役は頂部まで画面に入れる。遠景に `anvil`）, `sea{palette:'summer', sunY:-70}`, `bridge` |
| 夜の臨海公園 | dev_bg_3。上の「夜の臨海公園の組み方」を参照 |
| 病室 | dev_bg_5。`hospitalView` を窓の矩形に描き、窓枠・カーテン・壁を重ねる |
| 嵐の橋 | dev_bg_4。上の「雷光の組み方」を参照 |
| 三日月の夜 | dev_bg_7。`skyDome{preset:'night'}`, `stars`, `moon{phase:0.2}`, `cloudBand{kind:'streak', palette:'night'}`, `skyline`（町並み `style:'town'`）, `wires` |
| 夕焼け | dev_bg_8。`sunset` ＋ `sea{palette:'sunset'}` ＋ 逆光の `bridge` |
| 沈黙の日々（曇り） | `skyDome{preset:'overcast'}`, `cloudBand{kind:'deck', palette:'overcast', coverage:0.7}`。光源は雲の切れ間の `glow` 1 つだけにする |
| 音が戻る夏 | `skyDome{preset:'summer'}`, `sun`, `cumulonimbus{lightZ:-0.3}`（逆光の銀の縁）, `godRays`, `flare` |

---

## 残っている弱点（美術監督の判断）

- **雲の塗り**: 3 面の塗り分けと筆のゆらぎで「描いた雲」になった。ただし筆致のかすれや、輪郭のハッチングはない。至近距離（画面の半分を雲が占める寄り）では、まだ形の生成ロジックが見える。
- **入道雲**: 光の面のディテールは良いが、塔の陰影は「一枚の大きな形」として少し単調。かなとこは横に長い帯で、内部の巻き込み構造はない。
- **嵐**: 暗い時の塊の量感は出た。雷光の瞬間はセルごとに照らされるが、セル同士の奥行きの差（遠いセルほど霞む）は 2 段階しかない。
- **木漏れ日**: 日だまりの形は不規則になった。ただし時間変化は「模様が風でずれる」だけで、斑が開いたり閉じたりはしない。
- **海**: 近景の白波は小さな記号的表現。砕ける波、岸の波打ち際はない（必要ならカット側で描く）。
- **葉**: 3 種の形にしたが、近接（画面の 1/3 を占める枝）では、まだ切り絵の印象が残る。被写界深度で逃がすこと。
- **夜景**: 窓の格子は規則的。遠景・中景では良いが、近景の大きなビルには向かない。
