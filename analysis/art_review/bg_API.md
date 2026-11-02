# 背景美術ライブラリ API — `pv/engine/lib/atmos.js`（PV.lib）

劇場アニメ背景（光と空気）用の Canvas2D ライブラリ。すべて決定論的（`t` と `seed` だけで決まる）。
座標は 1920×1080 のキャンバス座標（y は下向き）。角度はラジアンで、0 は右、`-Math.PI/2` は上。
重い静的絵（雲・海の下地・帯雲・嵐の雲・スカイライン・病室の遠景）は初回だけピクセル単位で描いて `PV.cached` / LRU に保存する。2 フレーム目以降は `drawImage` と小さなストロークだけになる。

ショーケース: `pv/scenes/_dev_bg.js`（`dev_bg_1`〜`dev_bg_8`）。各カットの組み方はこのファイルをそのまま参考にしてよい。

## 最終画像

| 画像 | パス |
|---|---|
| 8カット一覧 t=4 | `analysis/art_review/bg/overview_t4.00.jpg` |
| 8カット一覧 t=0 | `analysis/art_review/bg/overview_t0.00.jpg` |
| 1 春の青空と積雲 | `analysis/art_review/bg/dev_bg_1_{0.00,4.00}.jpg` |
| 2 夏の海・入道雲・白い大橋 | `analysis/art_review/bg/dev_bg_2_*.jpg` |
| 3 夜の臨海公園（対岸の夜景・水面・夜の橋・ボケ） | `analysis/art_review/bg/dev_bg_3_*.jpg` |
| 4 嵐の橋（t=0 暗、t=4 雷光） | `analysis/art_review/bg/dev_bg_4_*.jpg` |
| 5 病室の窓外（窓枠つき使用例） | `analysis/art_review/bg/dev_bg_5_*.jpg` |
| 6 中庭の木漏れ日 | `analysis/art_review/bg/dev_bg_6_*.jpg` |
| 7 三日月の夜（住宅街・電線） | `analysis/art_review/bg/dev_bg_7_*.jpg` |
| 8 夕焼けの海と橋 | `analysis/art_review/bg/dev_bg_8_*.jpg` |
| 旧テストシーン互換確認 | `analysis/art_review/bg_compat/compat_sheet.jpg` |
| 各カットの t=0 / t=4 並び | `analysis/art_review/bg/sheet_dev_bg_{1..8}.jpg` |
| 改修前（比較用） | `analysis/art_review/bg_base/` |

## 互換性について

旧関数（`sky, cloudSprite, clouds, haze, glow, godRays, dust, bokeh, flare, rain, splashes, lightningPath, lightning, petals, sea, bridge, skyline, stars, noteShape, noteStorm, paper, blurred`）は、引数をすべて以前どおり受け付ける。
- 以前のオプション名と意味はそのまま。追加したのはオプションだけ。`dev_sky / dev_storm / dev_sea / dev_title_*` はエラーなく描け、見た目だけ新しくなる。
- 振る舞いが変わった点:
  - `L.bridge` と `L.skyline` は灯りの配列を返すようになった（従来の呼び出しは戻り値を無視するので影響なし）。
  - `noteStorm({count:0})` は 0 個を描く（以前は誤って 260 個描いていた）。
  - `L.lightning` は `shadowBlur` を使わなくなり、約 5 秒→約 15ms に短縮。

## 処理コスト（ヘッドレス Chromium、ラスタライズ込み）

`first` はキャッシュ生成込みの初回、`steady` は 2 フレーム目以降。

| 関数 | first | steady |
|---|---|---|
| skyDome | 57ms | 1ms |
| clouds ×6 | 0.9s | 3ms |
| cumulonimbus 1180×720 | 0.85s | 0.5ms |
| cloudBand（cirrus） | 75ms | 2ms |
| cloudBand（mackerel） | 250ms | 3ms |
| stormClouds | 380ms | 10ms（雷光時 19ms） |
| rainCurtain ×7 | 41ms | 12ms |
| rain 700本 | 7ms | 6ms |
| lightning | 19ms | 15ms |
| sea | 65ms | 11ms |
| nightWater | 64ms | 11ms |
| bridge | 3ms | 1ms |
| skyline | 41ms | 0.4ms |
| stars | 2ms | 1ms |
| moon | 4ms | 4ms |
| godRays | 14ms | 13ms |
| komorebi | 39ms | 25ms |
| canopy | 37ms | 28ms |
| foliage | 21ms | 16ms |
| hospitalView | 0.43s | 29ms |
| sunset | 0.52s | 20ms |

`steady` はすべて 40ms 以内。初回コストはワーカーごとに 1 回だけかかる。

**注意:** スプライト生成のパラメータ（色・光の向き・サイズ・haze など）は毎フレーム変えないこと。値ごとに新しいスプライトが作られ、重くなるうえメモリも増える。動かしてよいのは位置・`t`・`alpha`・`scale` だけ。

---

## 空

### `L.sky(ctx, stops, y0=0, y1=H)`（旧）
縦グラデーションで全画面を塗る。`stops` は `[[pos,'#hex'],...]`。

### `L.skyDome(ctx, t, o)` ★新
描き込まれた空。天頂→地平線のグラデーション、ごく低周波の色むら（絵の具の揺らぎ）、地平線の霞、太陽の順に描く。
LRU キャッシュするので、静止した空なら 1 フレーム約 1ms。

| オプション | 内容 |
|---|---|
| `preset` | `'spring'` `'summer'` `'autumn'` `'sunset'` `'dusk'` `'dawn'` `'night'` `'city'`（街明かりで赤紫に濁る夜）`'storm'` `'overcast'` |
| `stops` | 独自のグラデーション（0=上端、1=地平線） |
| `horizon` | 地平線の y（既定 0.7H）。これより下は霞の色で塗る |
| `top`, `x0`, `x1`, `y1` | 塗る範囲 |
| `haze` | 地平線の霞の強さ 0..1（プリセット既定あり） |
| `hazeColor`, `hazeH` | 霞の色と高さ |
| `sun` | `{x, y, scale, intensity, rays, halo, color, glow}` |
| `texture` | `false` で色むらなし |
| `textureAmt`, `seed` | 色むらの量とシード |
| `cache` | `false` で毎フレーム直描き |

太陽を毎フレーム動かすなら、`sun` は渡さずに `L.sun` を別に呼ぶこと（LRU を汚さないため）。

### `L.sun(ctx, x, y, o)` ★新
太陽。広い散乱光 → コロナ → 光輪（22°ハロー風の淡い虹色リング）→ 細い光芒（ゆっくり回転）→ 白飛びした円盤、の順に描く。

| オプション | 既定・内容 |
|---|---|
| `scale` | 1（円盤の半径は約 44px） |
| `intensity` | 1 |
| `color`, `glow` | 色 |
| `halo` | true |
| `haloR` | 330 |
| `haloAmt` | — |
| `rays` | 0..1、既定 0.55 |
| `t` | 光芒の回転に使う |
| `disc` | true |

画面外（y が負）に置くと「上から差す強い日差し」になる。

### `L.moon(ctx, o)` ★新
月。既定は三日月。

| オプション | 既定・内容 |
|---|---|
| `x`, `y` | 位置 |
| `r` | 44（推奨 40〜70） |
| `phase` | 照らされた割合。0.18=三日月、0.5=半月、1=満月 |
| `tilt` | 輝いている縁が向く角度 |
| `color`, `glow` | 色 |
| `intensity` | — |
| `earthshine` | 地球照で暗部がうっすら見える。既定 0.12 |
| `halo` | 月暈。0..1 |
| `texture` | 海（暗い模様）を入れる |

---

## 雲

### `L.cloudSprite(key, o)`（旧＋拡張）→ canvas
返すのは `(w+120)×(h+120)` のスプライト（周囲 60px は透明）。雲底は y=60+h。

**作り方**
- フラクタルな「もこもこ」球群を作る。塔 → 側面の膨らみ → 子 → 孫 → 曾孫の順に細かくなる。
- それらを soft-union で高さ場・法線場にまとめる。
- その上で次の陰影を付ける。
  - 大形状と細部の二重法線
  - 光に向かってのレイマーチによる落ち影（もこもこの下に、くっきりした影ができる）
  - 谷間の AO
  - 雲底の暗化
  - 雲底の反射光（bounce）
  - 逆光時の銀の縁（rim）
  - 平らな雲底
  - 大気遠近（haze）

細かいもこもこは輪郭側に集めてある。光の当たる面は静かにし、カリフラワー状の凹凸はシルエットに出る。

| オプション | 内容 |
|---|---|
| `w`, `h`, `seed` | サイズとシード |
| `type` | 下の表を参照 |
| `palette` | `'day'` `'spring'` `'summer'` `'autumn'` `'sunset'` `'sunsetHigh'` `'dusk'` `'storm'` `'night'` `'overcast'`（`L.CLOUD_PAL`） |
| 個別色 | `lit` `mid` `shadow` `rim` `hi` `deep` `bounce` `hazeColor`（旧 `colors{lit,mid,shadow,rim}` もそのまま使える） |
| `light` | 光の来る 2D 方向。既定 -2.2（左上） |
| `lightZ` | 正なら手前から当たる（順光）、負なら逆光。既定 0.5 |
| `haze` | 0..1 |
| `fade` | 下側のこの割合が地平の霞に溶ける |
| 微調整 | `cast`（落ち影 0.45）`ao` `sharp`（明暗境界の締まり）`macro` `levels` `soft` `ragged` `baseDark` `lift` |

| `type` | 見た目 |
|---|---|
| `'cumulus'` | 春の積雲 |
| `'tower'` | 入道雲 |
| `'puff'` | 小さな綿雲 |
| `'flat'` | 層積雲 |
| `'storm'` | ちぎれた暗雲 |

### `L.clouds(ctx, t, o)`（旧＋拡張）
流れる雲の群れ。小さい雲（遠い雲）から順に描く。

| オプション | 内容 |
|---|---|
| 旧オプション | `seed` `count` `y0` `y1`（スプライト上端の範囲）`minW` `maxW` `speed` `alpha` `colors` `scale` |
| `type`, `palette`, `light`, `lightZ` | `cloudSprite` と同じ |
| `aspect` | `[min,max]`（h/w） |
| `sun` | `{x,y}` を渡すと、雲ごとに太陽の方向から照らす。太陽に近い雲は自動で逆光になる。`lightZ` を渡せば固定できる |
| `horizon` | 地平線に近い雲ほど霞む |
| `hazeK` | その霞の強さ |
| `x0`, `x1` | 水平範囲を制限する（その範囲内で流れて折り返す） |

推奨サイズ: 近景の積雲は w 500〜1000、遠景は 160〜360（`type:'puff'`）。

### `L.cumulonimbus(ctx, t, o)` ★新
入道雲。水平線に立つ巨大な塔。

| オプション | 既定・内容 |
|---|---|
| `x` | 中心の x |
| `base` | 雲底の y（水平線の少し下にすると霞に沈む） |
| `w`, `h` | 1100×760（推奨 900〜1300 × 600〜800） |
| `seed`, `palette` | `palette` の既定は `'summer'` |
| `light`, `lightZ` | 劇的にしたいなら -2.75 / 0.3 |
| `haze`, `fade` | `fade` 既定 0.3 |
| `drift` | px/s |
| その他 | `scale` `alpha` `type`（`'cumulus'` にすると横長の雲塊） |

### `L.cloudBand(ctx, t, o)` ★新
ノイズで描く雲の帯。矩形 `x,y,w,h` に描き、x 方向に流れて継ぎ目なくループする。

| `kind` | 見た目 |
|---|---|
| `'streak'` | 層状の雲の筋。夕焼けでは `light:Math.PI/2` で下から照らす |
| `'cirrus'` | 繊維状の巻雲 |
| `'deck'` | 上が厚い層雲 |
| `'mackerel'` | うろこ雲（遠近つき、静止画を平行移動するだけ） |

| オプション | 内容 |
|---|---|
| `seed` | シード |
| `coverage` | 量 0..1 |
| `softness` | 縁の柔らかさ |
| `scaleX`, `scaleY` | 模様の大きさ |
| `palette`, 色 | 雲の色 |
| `light` | 光の方向 |
| `gain` | 縁の明暗差。既定 1.5 |
| `base` | 基準の明るさ。既定 0.6 |
| `thick` | 厚い所の暗さ |
| `res` | 解像度。既定 0.5 |
| `speed`, `alpha`, `mode` | 流れる速さ、不透明度、合成モード |
| `cell`, `perspective` | mackerel 用 |

### `L.stormClouds(ctx, t, o)` ★新
嵐の暗雲天井。横方向に継ぎ目なくループし、流れる。

| オプション | 既定・内容 |
|---|---|
| `y`, `h` | 640（雲底のちぎれた部分を含む高さ） |
| `base` | 雲底の平均位置 0..1、既定 0.78 |
| `seed`, `speed` | `speed` 既定 14px/s |
| `scud` | true（低く速く流れるちぎれ雲） |
| `flash` | 0..1。雷光で内側から照らされた版を、`flashX` `flashY` `flashR` を中心に放射状にクロスフェードする |
| `colors` | `{top,dark,mid,light,edge,fl,flMid,flDark}` |
| `alpha` | — |

`L.flashCurve` と組み合わせて使う。

### `L.haze(ctx, t, o)`（旧）
薄い霞の筋。柔らかいスプライトになり、輪郭が硬くなくなった。

---

## 光

### `L.glow(ctx, x, y, r, color, a, mode)`（旧）
放射状の発光。

### `L.godRays(ctx, t, o)`（旧＋高速化）
光芒。1/4 解像度で描き、そこでぼかしてから拡大するので輪郭が自然に柔らかい（約 13ms）。

- 旧オプション: `x` `y` `angle` `spread` `count` `length` `width` `flare` `color` `alpha` `seed` `jitter` `flicker` `mode`
- 新: `blur`

### `L.dust(ctx, t, o)`（旧）
光の中の塵。スプライト化して高速になった。`mask(x,y)` で範囲を限定できる。

### `L.bokeh(ctx, t, o)`（旧）
縁が少し明るいボケ円盤。夜景のボケには次の設定を推奨。
- `mode:'lighter'`
- 彩度の高い暗めの色（`'#c8701c'` `'#c2456e'` `'#d0a246'` `'#5a86c8'`）
- `alpha` 0.4

### `L.flare(ctx, x, y, k, color)`（旧）
レンズフレア。アナモルフィックの横筋、ゴースト 7 個、虹色のリングゴースト。

---

## 天候

### `L.rain(ctx, t, o)`（旧）
雨の筋。頭が明るく尾が淡い 2 段ストロークになった。

### `L.rainCurtain(ctx, t, o)` ★新
雨のカーテン。嵐の雲の下に垂れる半透明の雨の幕で、縦に流れ、横にドリフトする。

| オプション | 既定 |
|---|---|
| `x0`, `x1`, `y0`, `y1` | 範囲 |
| `count` | 5 |
| `angle` | 0.12 |
| `speed` | 900 |
| `drift` | 18 |
| `color` | — |
| `alpha` | 0.35 |
| `seed` | — |

雷光と同期させるなら `alpha` を `0.5 + 0.3*flash` のように上げる。

### `L.splashes(ctx, t, o)`（旧）
跳ね返り。王冠状の小さな飛沫を追加した。

### `L.lightningPath(seed, x0, y0, x1, y1, rough, depth)` / `L.lightning(ctx, segs, strength, color)`（旧）
稲妻。発光は低解像度でぼかし、芯は 3 段の線で描く。

### `L.flashCurve(t, strikes, o)` ★新 → 0..1
雷光の強さ。`strikes` は落雷時刻の配列。主放電 → 0.09 秒後の再発光 → 0.2 秒後の余韻、の 3 段フリッカー。`o.decay` 既定 0.45。

**使い方の例（dev_bg_4）**
1. `fl = L.flashCurve(t,[0.9,4.0])` で強さを求める。
2. `L.stormClouds({flash:fl})` で雲を照らす。
3. `L.lightning(segs, flashCurve(t,[s],{decay:0.25}))` で稲妻を描く。
4. 橋に `rim` と `rimAmt:fl` を渡す。
5. 最後に全画面へ `rgba(220,232,255,0.28*fl)` を重ねて白飛びさせる。

### `L.petals(ctx, t, o)`（旧）
桜の花びら。先端の切れ込み、2 色グラデーション、回転と裏返り。

---

## 海と水面

### `L.sea(ctx, t, o)`（旧＋拡張）
海。次の要素を重ねる。
- キャッシュした下地: グラデーション、風紋の濃淡、遠くは細く近くは太い「描いた」さざ波、水平線の明るい線
- 下地を行ごとに揺らす描画（水面のゆらぎ）
- 生まれては消える反射のきらめき
- 太陽の下の光の道（グロー）と、無数の微小なグリント（強いものは十字の星）
- 手前のうねり

| オプション | 内容 |
|---|---|
| 旧オプション | `horizonY` `y1` `stops` `seed` `sparkle` `sunX` `sparkles`（既定 1200）`sparkleAlpha` `sparkleColor` |
| `palette` | `'summer'` `'spring'` `'autumn'` `'sunset'` `'night'` `'storm'`（`L.SEA_PAL`） |
| `sunY` | 太陽が低いほど光の道が強く細くなる |
| `road` | 光の道の強さ 0..1 |
| `roadWidth` | 光の道の幅 |
| `shimmer` | きらめき |
| `wobble` | 揺らぎの量 |
| `chop` | 波の細かさ・量 |
| `swell` | 手前のうねり 0..1 |

### `L.nightWater(ctx, t, o)` ★新
夜の水面。対岸の灯りが縦に伸び、ちぎれた横棒の連なりになって揺れる。

| オプション | 既定・内容 |
|---|---|
| `horizonY` | 岸線の y |
| `y1` | 下端 |
| `lights` | `[{x, w, c:'#hex', a}]`。普通は `L.skyline(...)` と `L.bridge({night:true})` の戻り値を `concat` して渡す。省略時は seed から生成 |
| `len` | 映り込みの長さ（水面の高さに対する割合）、既定 0.85 |
| `wobble` | 1 |
| `glow` | 街明かりの照り返し、既定 0.5 |
| `seed` | — |

---

## 構造物

### `L.bridge(ctx, o)`（旧＋拡張）→ 灯りの配列
白い斜張橋の側面図。

**各部の描き方**
- 桁: 上面ハイライト、側面、下面の影、欄干の線
- 主塔: 光の側と影の側で塗り分け、`style:'H'` なら二本脚の間に隙間が見える。塔頂の帽子と梁もある
- ケーブル: ファン状
- 橋脚: 主塔の下に加えて、取り付け部の小橋脚も描く

**夜（`night:true`）**
- 主塔の下からのライトアップ（`uplight` 既定 0.26）
- 赤い航空障害灯（`t` でゆっくり点滅）
- 桁の街灯（`lamps` 個、`lampColor`）

**オプション**

| オプション | 内容 |
|---|---|
| 旧オプション | `x0` `x1` `y`（桁）`towerH` `color` `lw` `alpha` `towers` `pierH` `cables` |
| `night`, `t` | 夜景モード、点滅用の時刻 |
| `shadow` | 影側の色 |
| `light` | `'left'`/`'right'` |
| `haze`, `hazeColor` | 遠景の霞 |
| `span` | ケーブルの広がり |
| `lamps`, `lampColor`, `uplight` | 夜の灯り |
| `flash` | 雷光 |
| `rim`, `rimAmt` | 光の側の縁だけ光らせる（雷光・夕日の逆光用） |
| `style` | `'H'` / `'I'` |

**推奨値**
- 遠景: `lw` 1.5〜2.5、`towerH` 70〜120、`haze` 0.15〜0.3
- 中景: `lw` 3〜4.5、`towerH` 150〜230
- 嵐の近景: `lw` 8、`towerH` 420

### `L.skyline(ctx, o)`（旧＋拡張、キャッシュ）→ 灯りの配列
ビル群のシルエット。

**窓明かり**
- フロア単位の帯（オフィスの階がまとめて点灯・消灯）
- 住宅のように点々と灯るビル
- ほぼ消灯のビル

**その他の描き込み**
- 屋上の段差、塔屋、アンテナ
- 航空障害灯（`t` で点滅）
- 低層部への街灯の照り返し
- 窓明かりの滲み（`glow`）
- `style:'town'` で切妻屋根の住宅街になる

**オプション**

| オプション | 内容 |
|---|---|
| 旧オプション | `seed` `y`（地面）`hMin` `hMax` `color` `windowColor` `lit` `x0` `x1` `wMin` `wMax` |
| `windowColors[]` | 窓の色の候補 |
| `win` | `[w,h,gapX,gapY]`（既定 `[3,4,8,9]`） |
| `glow` | 窓明かりの滲み |
| `rim` | 縁の光 |
| `skyGlow` | 背後の街明かり |
| `haze`, `hazeColor` | 遠景の霞 |
| `gap` | ビル同士の隙間 |
| `style:'town'` | 住宅街 |
| `beacons` | 航空障害灯 |
| `t` | 点滅用の時刻 |

昼の遠景に使うときは `lit` を省き、霞色にする（dev_bg_1・病室の遠景を参照）。

### `L.stars(ctx, t, o)`（旧）
星。等級差、色温度、またたき、明るい星の十字の光芒。

- 旧オプション: `seed` `count` `yMax` `alpha`
- 新: `x0` `x1` `y0`

### `L.wires(ctx, o)` ★新
電柱と電線のシルエット（日本の住宅街）。

| オプション | 既定 |
|---|---|
| `poles` | `[x...]` |
| `y` | 腕木の高さ |
| `h` | — |
| `color` | — |
| `lw` | 3 |
| `lines` | 4 |
| `sag` | 60 |

---

## 植物と木漏れ日

### `L.foliage(ctx, t, o)` ★新
揺れる枝葉。
- 枝: 3 分割でゆるく曲がり、先細りする。途中の節から側枝が出る。
- 葉: 卵形で、葉脈の左右を 2 トーンに塗る。枝に沿って互生し、枝先には房になる。
- 動き: 重力で垂れ、風で揺れ、葉は 1 枚ずつそよぐ。

| オプション | 既定・内容 |
|---|---|
| `x`, `y` | 根元 |
| `angle` | 伸びる方向 |
| `length` | 420 |
| `width` | 14 |
| `depth` | 5 |
| `density` | 1 |
| `leaf` | 葉の大きさ 22px |
| `cluster` | 枝先の房の量 |
| `droop` | 垂れ具合 0.1 |
| `colors[]` | 葉の色 |
| `branchColor` | 枝の色 |
| `back` | 逆光で透ける量 |
| `shade` | 影に沈める量 |
| `shadeColor`, `backColor` | 影の色、透けた時の色 |
| `wind` | 1 |
| `blur` | 手前ボケ用 |
| `seed` | — |

### `L.canopy(ctx, t, o)` ★新
見上げた木々の天蓋。画面上部を葉の天井で覆う。
- 奥の葉: 暗い塊になる。
- 太陽の近くの手前の葉: 黄緑に透ける。
- 隙間: 空と太陽がのぞき、きらきらとまたたく。

| オプション | 既定・内容 |
|---|---|
| `x0`, `x1`, `y0` | 範囲 |
| `y1` | 下端の平均 |
| `rag` | 下端のギザギザ、150 |
| `density` | 1〜2 |
| `leaf` | 26〜30 |
| `sun` | `{x,y}` |
| `sunR` | 700 |
| `glints` | true |
| `wind` | — |
| `seed` | — |
| `colors` | `{dark,mid,lit,glow}` |

`L.sun` を先に描き、その上に `canopy` を重ねること。

### `L.komorebi(ctx, t, o)` ★新
木漏れ日。光を受ける物（地面・ベンチ・人物・壁）を描いた後に重ねる。

**仕組み**
1. 冷たい青灰の木陰を multiply で落とす。
2. 光の模様を作る。暖色のくっきりした太陽像（ピンホール像）が房状に集まった、タイル状の模様。
3. それを地面の遠近に合わせた帯（mode-7 方式）で投影する。
4. 低周波の「梢の隙間」マスクで、光がまだらに当たるようにする。
5. 2 層の模様のずれでチラチラさせ、数十個の単独のきらめきを加える。

| オプション | 既定・内容 |
|---|---|
| `x0`, `y0`, `x1`, `y1` | 範囲 |
| `perspective` | 0=壁/真上、1=強い地面遠近。既定 0.7 |
| `scale` | 模様の大きさ |
| `density` | 0.6 |
| `coverage` | 光の当たる割合 0.6 |
| `color` | `'#ffd583'` |
| `strength` | — |
| `shade` | 0.75 |
| `shadeColor` | — |
| `count` | 単独のきらめき 60 |
| `spot` | — |
| `wind` | — |
| `seed` | — |
| `flat` | 壁での縦横比 0.72 |

### `L.hospitalView(ctx, t, o)` ★新
病室の窓から見る外の景色。矩形 `x,y,w,h` にクリップし、cover で合わせて描く。

**内容**
- 秋の高い青空と、遠近のついたうろこ雲（ゆっくり流れる）
- 巻雲
- 霞んだ山並みと街
- 湾と、遠くの白い大橋
- 窓辺に掛かる、黄葉しかけた枝（揺れる）

| オプション | 既定・内容 |
|---|---|
| `x`, `y`, `w`, `h` | 描く矩形 |
| `seed` | — |
| `branches` | true |
| `wind` | — |
| `leafBlur` | 手前の枝をボカす px |
| `alignX`, `alignY` | 合わせ位置 |
| `bridge` | true |
| `bridgeX` | 0.36 |

窓枠・カーテン・室内の壁は呼び出し側で描く（dev_bg_5 に例がある）。

### `L.sunset(ctx, t, o)` ★新
夕焼け空の完成形。

**内容**
- 天頂は群青、そこから紫・桃・橙・金へのグラデーション
- 低い太陽
- 下から照らされた高層の筋雲（`sunsetHigh`）
- 夕日色の積雲（胴は紫、太陽側の縁が金）
- 水平線近くの暗い筋雲
- 薄明光線

| オプション | 既定 |
|---|---|
| `horizon` | 0.66H |
| `sunX`, `sunY` | — |
| `seed` | — |
| `preset` | `'sunset'`/`'dusk'` |
| `cumulus` | — |
| `rays` | — |

海と組み合わせるなら `L.sea({palette:'sunset', sunX, sunY, road:0.9})` を使う。

---

## その他（旧）

- `L.noteShape(ctx, s, kind)`, `L.noteStorm(ctx, t, o)`: 音符の嵐
- `L.paper(ctx, alpha, seed)`: 紙の質感のオーバーレイ
- `L.blurred(ctx, px, fn, key)`: 被写界深度風のぼかし

## 定数

- `L.SKY`: 空のプリセット
- `L.CLOUD_PAL`: 雲のパレット
- `L.SEA_PAL`: 海のパレット

色を作るときの参照用。

---

## 残っている弱点

- **雲の質感**: 雲はピクセル単位の 3D 陰影なので、手描き背景と比べると「CG らしい滑らかさ」がわずかに残る。筆致のかすれや、輪郭線の意図的な強弱はない。落ち影の縁が硬い所も一部残る。
- **入道雲の頂部**: 画面上端で切れる構図だと頂部の形が見えない。かなとこ雲の表現はない。
- **嵐の雲**: 暗い時は煙のように見える部分がある。塊感が出るのは雷光の時の方。
- **komorebi の模様**: やや均一で、光の斑の形がすべて円形。葉の形の影や、斑の縁の色にじみ（色収差のようなもの）はない。
- **海**: 近景の波頭（白波・砕ける波）はない。うねりは淡い帯で表しているだけ。
- **foliage / canopy の葉**: 葉の形が 1 種類で、近づくと切り絵のように見える。被写界深度が必要なら `blur` か `L.blurred` を併用する。
- **mackerel（うろこ雲）**: 静止テクスチャを平行移動しているだけで、雲片そのものは変形しない。
- **skyline**: 箱型ビルが中心。観覧車やランドマーク的な形はない。
- **初回の重さ**: 雲を多く使うカットは、初回フレームが約 1〜2 秒（キャッシュ生成）かかる。動画ではワーカーごとに 1 回だけ。
