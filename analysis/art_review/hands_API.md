# hands.js — 手の作画ライブラリ API（総作監チェック後・最新版）

`pv/engine/lib/hands.js`（名前空間 `PV.lib`）。ショーケース：`pv/scenes/_dev_hands.js`（`dev_hands_1`〜`dev_hands_10`）。
最新レンダリング：`analysis/art_review/hands/`（一覧 `overview.jpg`、各 `dev_hands_N_sheet.jpg`）。修正前後の比較・講評：`analysis/art_review/hands_critique.md`、`analysis/art_review/hands_review/before_after.jpg`。

## 仕組み（全関数共通）
- 手は **小さな3D骨格**（中手骨＝手のひらの球群、各指3節、親指＝中手骨＋2節）を解剖学的な屈曲で動かし、弱パースのカメラで投影して、**セル塗りの2D図形**（先細りカプセル＋手のひら凸包）として描く。
- 体格：`kind:'her'`＝細く長い指（ピアニスト）・短い爪、`kind:'him'`＝7%大きく骨ばった手。指の軸は付け根の拳頭より細く、末節は先細り（指先は手のひら側に肉球、爪側は平ら）。関節のふくらみは**背側**にだけ出る（側面の輪郭は滑らか）。親指の付け根に母指球のふくらみ。
- 指の長さ比：中指＞薬指≧人差し指＞小指、親指は手首寄り（CMC）から生える。
- 座標：`x,y` は **手首の画面位置(px)**（ポーズ関数は各関数の基準点）。`rot`＝画面回転(rad、0で指先が上)。`scale:1` で手首→中指先 ≈195px。呼び出し側 `ctx` の変換（カメラズーム等）もそのまま反映。
- `light`＝**光の来る方向**(rad, 画面空間)。既定 `-2.3`（左上）。props/instruments と同じ規約。
- **線**：スタイルガイド準拠の細い暖色線。光側の実効幅 ≈1.1〜2.1px（手の大きさで自動）、影側はその約1.7倍。`lw` で上書き可。しわ・傷などの細部は別の幅（`dw`）。
- **シーンの光で肌を染める（新）**：`keyColor`（光の色：ベース・ハイライト・爪を乗算で染める）、`fillColor`（影側の色：影・線を染める）、`tint`（強さ 0〜1、既定0.7）。影は key 光も一部受けるので、1影のコントラストは保たれる（黒い縁取りにならない）。
  - 例：ライブハウス `keyColor:'#ffc890', fillColor:'#6a4a78', tint:0.75`／雨の窓 `keyColor:'#c9d4e6', fillColor:'#7c89a6', tint:0.8`／夜の部屋 `keyColor:'#c9b8d8', fillColor:'#5a4a72'`／病室 `keyColor:'#f4f8ff', fillColor:'#b9c7da', tint:0.5`／音楽室の午後 `keyColor:'#fff3dc', fillColor:'#e2b8a6', tint:0.5`。
- `style`：
  - `'cel'`（既定）：ベース＋1影＋ハイライト、爪、関節のしわ、掌紋、タコ、傷。
  - `'rim'`（逆光）：暗い肌（`dark`、既定 `#3e2c33`）＋光側の縁に明るいリム（`rimColor`）→暖色の透過光帯（`sss`）→暗部。**光側の線は光に食われる（色トレス）**、影側だけ細い暗線。爪・しわは描かない。低解像度ブルームのグロー付き（`glow`）。
  - `'silhouette'`：単色（`color`）、`rimWidth` で細いリム。
- 決定論的（`Math.random` 不使用、震えは `PV.noise2(t)`）。ctx の状態は必ず復元。描画は内部バッファに合成してから ctx へ1回 drawImage。

## 汎用リグ

### `PV.lib.hand(ctx, o)` → rig
| 引数 | 既定 | 説明 |
|---|---|---|
| `x,y,rot,scale` | 0,0,0,1 | 手首の位置・画面回転・倍率 |
| `side` | `'R'` | `'R'`/`'L'`（`'L'`は鏡像） |
| `kind` | R→`'her'`, L→`'him'` | 体格プリセット |
| `view` | `'back'` | `'back'` 手の甲／`'palm'` 手のひら／`'side'` 親指側／`'edge'` 小指側 |
| `yaw, pitch` | 0 | view に追加するカメラ回転(rad)。pitch>0 で指先が奥へ倒れる |
| `curl` | `[.12,.12,.14,.16,.18]` | [親指,人差,中,薬,小] 0〜1 の曲げ（負で反らす） |
| `spread` | 0.3 | 指の開き 0〜1 |
| `flex` / `thumb` / `pose` | – | 関節角の直接指定 `[[mcp,ip],[mcp,pip,dip]×4]`(rad)／親指 `{abd, opp, flex:[mcp,ip], twist}`／`{F:[{flex,splay}×4], T:{...}}` で全指を直接 |
| `calluses` | 彼の左手で true | 指先の弦のタコ（掌側：平たい淡黄の硬い皮膚＋薄茶の縁＋弦の溝線） |
| `thumbScar` | false | 左手親指の付け根の傷（掌側〜橈側を回り込む） |
| `surgicalScars` | false | 右手〜前腕の縫合痕（**治癒後**の淡い桃色の盛り上がった線＋かすかな縫合点。手の甲・人差し/中指・手首・前腕） |
| `t, tremble, seed` | 0,0,0 | 時間と微小な震え(0〜1) |
| `arm` | 320 | 見える前腕の長さ（ローカル単位、0で手首まで。短い時は先端が1つの丸い端で閉じる） |
| `sleeve, sleeveAt` | – | 袖の色（紺ブレザー `'#2b3252'`、革ジャン `'#2c2420'`、白シャツ `'#f1f1ee'`）と袖口位置。袖は肘側へ少し広がる。**袖口を覗くアングル**では袖を手の奥に回し、腕は袖口で切って、手前の縁（lip）と奥の暗がりで「腕が袖に入る」形にする |
| `keyColor, fillColor, tint` | – | シーンの光（上記） |
| `skin, shade, hi, line, blush, nail` | 設定値 | 色の上書き（基準：肌 #f3d3bf／影 #d9a38e／ハイライト #fff1e6／線 #6b3f33） |
| `dark, rimColor, sss, rimWidth, bounce` | – | rim スタイル用 |
| `color` | – | silhouette 色 |
| `lw, detail` | 自動, 1 | 線幅の上書き、細部（しわ・掌紋）の濃さ |
| `alpha, blur, glow` | – | 合成時の不透明度・ぼかし(px)・グロー強度(rim) |
| `layer, split, depthFn, zBias` | 自動 | 指ごとの描画層 `{i:'g0'|'front'|'back'}`、`split:{i:j}` で指を関節 j で前後2パーツに（親指は `{0:2}`）、`depthFn(item)` で描画順を上書き |

戻り値の rig：`rig.tips[i]`（指先の画面座標）、`rig.joints[i][j]`、`rig.wrist`、`rig.P(p3)`（ローカル3D→画面）、`rig.unit`（px/単位）。小物の配置に使える。

### `PV.lib.handRig(o)` / `PV.lib.handRender(ctx, rigs, ro)`
描かずにリグだけ作る／複数のリグを**奥行きソートして一緒に**描く（`ro.filter(item)` で一部だけ、`ro.alpha, ro.blur, ro.glow, ro.pad`）。`o.camera, o.handMatrix, o.handPos` で任意の3D空間に手を置ける（ポーズ関数はこれで鍵盤・ネック・相手の手と同じカメラを共有）。

## ポーズ関数

### `PV.lib.handOnKeys(ctx, o)` — 鍵盤の上で弾く右手
- 鍵盤（白鍵・黒鍵・鍵盤底、黒い譜面台側パネル＝**手の映り込み**付き）を**手と同じ3Dカメラ**で描き、各指を IK で鍵の上に置く。届かない時は手を自動で下げる。手の影が鍵盤に落ちる。
- **既定カメラ `az 0.8, el 0.52`**：奏者の右・斜め上から。手・沈んだ鍵・譜面台の映り込みが一度に読める（旧既定 `az -2.35` は譜面台側から奏者を見る逆アングル。袖口を覗く形になる）。`az 1.2, el 0.4` で高音側から横顔、`az -0.9, el 0.5` で低音側から（映り込みが画面左上に来る）。
- `x,y`：注視点（中指の鍵の手前）。`scale` 推奨 2.8〜3.5。
- `press:[5]`（親指〜小指）：`-1` 持ち上げ … `0` 鍵に置く … `1` 打鍵（鍵が沈む）。`PV.lib.handPressCurve(u)` で「上げる→打つ→保持→離す」（例 `press[i]=L.handPressCurve(t*1.25 - i*0.85)`）。
- `keys:[5]`（中指の白鍵を0としたオフセット、黒鍵は `{b:n}`）、`sun`（影の3D光方向）、`shadow`、`fallboard`、`reflection`、`range`、`keyTone`、`wristY, wristZ, tilt, roll`、`sleeve, sleeveAt`、`keyColor/fillColor`。
- 例：`L.handOnKeys(ctx,{x:980,y:560,scale:3.2,t,press,sleeve:'#2b3252',sleeveAt:70,arm:300,keyColor:'#fff3dc',fillColor:'#e2b8a6',tint:0.5})`

### `PV.lib.handOnFrets(ctx, o)` — コードを押さえる左手
- ローズウッド指板・フレット・ポジションマーク・6弦を描き、指を IK で弦の上に置く。**手は自動で滑らせて全指が届く位置に置く**（押さえる指の誤差 1.5u 未満まで反復）。指の影が指板に落ちる。
- **既定カメラ `az -0.5, el 0.42`**（ボディ側の斜め上）：4本の指が別々のアーチとして読め、指先が弦に乗っているのが見える。正面（az≈0）だと指は奥へ短縮して「突起」になるので避ける。
- `chord:[[fret,string]|null ×4]`（人差し〜小指、string 1=高音E(下)〜6=低音E(上)）。既定 `[[5,2],[6,4],[7,5],null]`（5ポジションのCフォーム）。**自然なフォームを渡すこと**（人差し指が一番低いフレット・指が交差しない形）。不自然な形（例 `[[5,4],[7,3],[7,2],[8,1]]`）は指が重なって読めない。
- `press[i]`（0で弦から浮く：ハンマリング/プリング）、`vibrato:{i:amp}`、`stringVib`、`thumbOver`（**既定 false**＝親指はネック裏で見えない。true で親指の先を上辺に掛ける＝ジミヘン型。ただし既定カメラでは人差し指の陰に入りやすい）。
- `x,y`：コードの中心付近。`scale` 推奨 2.6〜3.2。暗い会場では `keyColor/fillColor` で染めること。

### `PV.lib.handsTouch(ctx, o)` — 第五話「左手、見せて」
- 上向きに開いた**彼の左手のひら**（指先に読めるタコ）に、**彼女の右手の人差し指**がそっと触れる俯瞰。彼女の手の柔らかい影が彼の手に落ち、高さ（approach）で影が離れる。触れた点に淡い光。
- `x,y`：接触点。`approach` 0→1。`touchFinger`（彼の指1〜4、既定2=中指）、`angle`、`thumbScar`、`herScars`、`herSleeve`（彼女の袖色、例 紺 `'#2b3252'`）、`his:{…}`, `her:{…}`（各リグの上書き。例 `his:{sleeve:'#f1f1ee',sleeveAt:150}`）。`scale` 推奨 2.4〜3。

### `PV.lib.handsInterlock(ctx, o)` — 指を絡めて繋ぐ（最終カット）
- 「恋人つなぎ」を**IKで物理的に組む**：手のひら同士が合わさり、手前の手の甲がカメラ側。**相手の指が指の間から出て、手前の手の拳頭のくぼみに指先（爪）を乗せる**。相手の手は親指側に半指ずらしてあり、**相手の親指は手前の手の橈側の縁を越えて手の甲に乗る**（`trace` で甲をなでる）。前腕は自然なV字。
- `from:'her'`（既定：彼女の縫合痕のある手の甲＋その上に乗る彼の4本の指と親指）／`'him'`（彼の手の甲に彼女の短い爪の指と親指が乗る）。`scars:true`（既定）。
- `x,y`：拳頭付近の画面位置、`rot`（0で指先が下、π で指先が上＝窓にかざす）、カメラ `az,el`（既定 -0.3, -0.1）、`squeeze` 0〜1（握りの強さ、指先が甲に沈む）、`trace` 0〜1、`vee` 前腕の開き、`interleave`（相手の手のずらし量）、`tipY:[4]`/`tipZ`（相手の指先の位置：手前の手のローカル座標）、`backSplay/frontSplay`、`herSleeve/hisSleeve`、`her:{}`/`his:{}`。`style:'rim'` で窓の逆光（`rot: Math.PI-0.35` で窓にかざす名カット＝dev_hands_6）。
- 戻り値 `{front, back, her, him}`。

### `PV.lib.armCast(ctx, o)` — ギプスとアームスリング
- **前腕〜手のひらを1つの滑らかな石膏の殻**で覆い（手首の段差なし）、拳頭の少し先から4本の指が出る（`tremble` で微かに震える）。テープの重なり線、石膏の粒、指側の綿の縁。
- **スリング**：腕を**下から受ける袋**（手前の布は腕の下半分を覆い、手首側は開いている。縫い目・引っ張りじわ・下側の陰）＋袋の両端から首へ向かう2本の帯（腕の奥）。
- `x,y` 手首、`rot`（既定 π/2+0.1：前腕が水平、指が右）、`coverFingers`（既定0.1）、`castPad`、`castColor`、`sling`, `slingColor`。病室なら `keyColor:'#f4f8ff', fillColor:'#b9c7da', tint:0.5`。

### `PV.lib.handOffer(ctx, o)` — ハンカチを差し出す手
- 手のひらを上にした手（既定 彼の右手）に、**柔らかい布の畳んだハンカチ**（丸い角・波打つ縁・2枚重ねの厚み・対角の折り目・縁の色帯・小指側に垂れる角）。描画順は 手→ハンカチ→親指（親指で押さえる）。
- 既定 `view:'palm', pitch:0.45, yaw:-0.1, rot:-1.1`（手のひらが見える角度で差し出す）。`reach` 0〜1、`hankieColor`, `hankiePattern`、`sleeve`。

### `PV.lib.handPress(ctx, o)` — 窓ガラスに押し当てた手のひら
- 手のひら側を見せた手（窓の外から）。**接地部（手のひらの膨らみ・母指球・指腹・指の節）の周りにだけガラスの曇り**が出て外へ薄れる（全体の光のオーラにはしない）。接地部の皮膚が白む。`press` 0〜1、`fogColor`。雨の窓（`L.rain`）と組み合わせ、`keyColor/fillColor` で青灰に染める。

### `PV.lib.handReach(ctx, o)` / `PV.lib.handFist(ctx, o)`
- `handReach`：光へ伸ばす手。**既定は手の甲がカメラ側**（窓の光へ手を伸ばす人物を背後から＝右手なら親指が左）、`pitch 0.35` で指先が光の奥へ。`open` 0〜1。`style:'rim'` で逆光の名カット（`dev_hands_9`）。
- `handFist`：握り拳。指は手のひらに完全に巻き込み、**親指は人差し・中指の中節の上に IK で乗せる**。`clench` 0〜1、`shake`（震え）。既定 `view:'back', yaw:-0.38, pitch:0.62`（拳の甲側・拳頭が上）。**`view:'palm', yaw:0.45, pitch:-0.15` で拳の正面**（爪が手のひらに食い込む・親指が横切る）＝悔しさのアップに向く。

## 補助
- `PV.lib.handPressCurve(u)`：打鍵の包絡（-0.6〜1）。
- `PV.lib.handKeys(ctx, o)`：手と同じカメラ規約の鍵盤だけ。
- `PV.lib.handKeyGeom`, `PV.lib.handNeckGeom`：鍵盤・ネックの寸法（ローカル単位 ≈1.08 u/mm）。

## 描画コスト（1920×1080、ヘッドレス Chromium、関数単体の中央値／初回）
| 関数 | 中央値 | 初回（バッファ確保込み） |
|---|---|---|
| `hand`（cel / rim） | 9ms / 9ms | 27ms / 11ms |
| `handsTouch`（袖・落ち影込み） | 37ms | 53ms |
| `handsInterlock`（cel / rim） | 27ms / 27ms | 39ms / 27ms |
| `handOnKeys`（鍵盤・影・映り込み込み） | 28ms | 32ms |
| `handOnFrets`（ネック・弦・指の影込み） | 25ms | 56ms |
| `armCast` | 16ms | 27ms |
| `handOffer` / `handPress` / `handFist` / `handReach(rim)` | 19 / 23 / 11 / 9ms | – |
- 各手の輪郭は `Path2D` にキャッシュし、影・リムのずらし塗りは `translate` で描くので、2つの手のカットも 40ms 以内。初回だけ内部バッファ確保で跳ねる。

## 使い方の目安（PVカット別）
| カット | 呼び出し | ポイント |
|---|---|---|
| 鍵盤の上の右手（音楽室） | `handOnKeys`（既定カメラ）, `sleeve:'#2b3252'`, `keyColor:'#fff3dc'` | `press` を劇伴に合わせる。譜面台の映り込みを画面に入れる |
| 弦を押さえる左手（ライブハウス） | `handOnFrets`（既定カメラ）, 自然なフォーム, `keyColor/fillColor` で琥珀×紫 | `press` で小指のハンマリング、`stringVib` |
| 「左手、見せて」 | `handsTouch`, `approach:smooth(t)`, `herSleeve` | 触れる瞬間に間（ま）。タコが読めるよう scale≥2.4 |
| ギプス（病室） | `armCast`, 冷たい白の背景 + 淡い tint | 指先の `tremble` を小さく |
| 指を絡める（最終カット） | `handsInterlock`（cel）, `trace` をゆっくり 0→0.5 | 傷が読めるよう scale≥3。逆光なら `style:'rim', rot:Math.PI-0.35` |
| 光へ伸ばす手 | `handReach{style:'rim', open}` | 窓・光芒・塵と合わせる |
| 雨の窓 | `handPress` + `L.rain` + 青灰 tint | 曇りは接地部だけ |
| 悔しさの拳 | `handFist{view:'palm', yaw:0.45, pitch:-0.15, shake}` | 暗部は tint で沈める |

## 既知の制限
- `handOnFrets` は指同士の衝突を解かない。指が交差するフォームは読めない。`thumbOver:true` の親指は既定カメラでは人差し指に隠れやすい。袖口を覗くアングルの袖は暗い穴として描かれる（`sleeveAt` を大きくして画面外へ出すのが無難）。
- 指は先細りカプセルの合成なので、超アップ（scale>4）では面の起伏（腱・骨の凹凸）が足りない。線に手描きの強弱の揺らぎはない。
- `handsInterlock` の相手の親指は付け根に円弧の継ぎ目がわずかに見える（scale 3.4 で目立たない程度）。
- 布（スリング・ハンカチ）は形状と陰影の作り込みまで。風になびく等の布シミュレーションはない。
