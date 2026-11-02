# anime_body.js — アニメ調の体・衣装・ポーズ API（作画監督：体）

`pv/engine/lib/anime_body.js`（名前空間 `PV.anime`）。ショーケース：`pv/scenes/_dev_anime_body.js`。
講評と修正記録：`analysis/art_review/anime_body_critique.md`。最新の確認画像：`analysis/art_review/anime_body/`（`dev_anime_body_N.jpg`、一覧 `overview.jpg`）。

| ショット | 内容 |
|---|---|
| `dev_anime_body_1` / `_2` | 先輩・彼の制服の型紙（正面・3/4・横・後ろ） |
| `_3` / `_4` | 全衣装の一覧（3/4） |
| `_11`〜`_15` | 全衣装の正面・横・後ろ（`_15` は C42 の `ending` と C41 の `spring2`） |
| `_5` | ピアノ：高音側の端から3/4（C02/C10）、右の横顔（ドレス、C17）、正面・上から（C10）、3/4後ろ |
| `_6` | 椅子：ジュース・拍手・ギター（3/4） |
| `_7` | 舞台：ストラト、膝立ち2種、**歩きながら肩越しに振り向く叔母**（C36） |
| `_8` | 手すり：横（C15）・帽子を押さえる斜め前・嵐（C27）、**カメラに向かって走る**（C20） |
| `_9` | 並んで座る：C42（夕日）・C22（夜、肩に頭）・C33（ソファ、隙間）・**C35（毛布、肩で眠る）** |
| `_10` | 抱擁（C32、二人の顔）、飛び込み（C20）、倒れ込み（C31） |
| `_neck` / `_leap` / `_dbg` / `_api` / `_perf*` | 開発用：首の確認（頭あり・なし）、飛び込みの角度表、計測など |
| `_lineup1`〜`6` / `_shots1`〜`6` / `_pairs1`・`2` | **統合シート**（頭×体の設定画の整合）：同じ地面・同じ頭の単位で並べた全衣装（正面・後ろ、頭頂と彼の鼻先の差）、全ポーズを本番の照明・本番の大きさで、二人のポーズ。講評は `anime_integration_review.md`、画像は `analysis/art_review/anime_integration/` |

顔・髪は `anime_head.js`（`PV.anime.head / headBack`、別担当）を **HEAD API の通りに** 呼ぶ。未ロード／例外時だけ簡易な代用の頭を描く。

## 1. 仕組み（ポリゴン・マネキンに見えないための作り）
- **3D なのは骨格だけ**：関節位置（IK）、楕円リングを積んだ胴（ロフト）、リングから垂らすスカート。見える物はすべて、投影した骨格から作る**なめらかな2D図形**で、面ごとの陰影や全身の3Dグラデーションはない。
- **手足は解剖の断面プロファイル**：腕・脚とも `[f, 外, 内, 前, 後ろ]` の半幅（`SPECS.upA / foreA / thighW / shinW`）。画面に見えている側の幅を混ぜるので、三角筋の張り・二の腕・肘のくびれ・前腕の膨らみ・平たい手首、太もも・膝・ふくらはぎ・足首の起伏がどの向きでも出る。
  先輩：上腕 0.24H、肘 0.15H、前腕 0.18H、手首 0.12H、太もも上端 0.47H、膝 0.24H、ふくらはぎ 0.27H、足首 0.14H（H＝頭の高さ）。
- **関節は1本の輪郭**（`limb2`）：内側は2本の輪郭の交点で折り、外側は**長さ制限つきのマイター（肘頭・膝頭の丸い尖り）**。球体関節の円弧は使わない。
- **首**：見える首は**頭ライブラリの首**（HEAD API `layer:'neck'`＝`PV.anime.neck`）。体はリグの首の軸（首の付け根→首の点）を `neckLen / neckLean / bodyYaw` で渡して胴より先に描かせる（`neckFade`、フレアなし）。頭だけのシート・`bust`・全身で同じ首（太さ、顎の形の影、入り抜きの線）。体の3リングのロフト（上端は斜め＝うなじ側が高い）はパスとして残り、襟ぐりのインク線のクリップに使う。寝ている／頭が大きく傾く（`|roll|>0.7`）時と `o.bodyNeck:true` の時だけ体の首を描く。首は前傾（`SPECS.neckFwd`）、**胸が前傾した分は首の前傾を減らす**（ピアノで頭が突き出ない）。付け根と全ての襟ぐりは**後ろが高い**（`NECK_TILT`）。うなずきは首 55%／頭 45%。
- **身長**：首の点を `-(H-0.88)` に置く（頭ライブラリは頭頂を首の点の 0.88 頭上に描く）＝先輩 7.0・彼 7.3・叔母 7.2 頭身ちょうど。素足の先輩の頭頂が彼の鼻先（決定稿 1-2）。
- **肩**：袖・素肌の上腕の付け根は肩峰（僧帽筋の線の先）を通り、その向きのまま三角筋を回って外側へ（肩パッド・パフスリーブの段差なし）。
- **頭の向き**：首の座標系 `J.Mn` をカメラ行列（向き＋`camPitch`）で分解して HEAD API の yaw / pitch / roll を作る。カメラの伏角は顔にも効き、横顔では首の前傾が「頭の傾き」にならない。`o.head.yaw / pitch / roll / turn` で上書きできる。
- **主線**：同じ奥行きの層の部品は1本の外形線を共有（塗りの後ろに描くストローク）。光と反対側を太く、光側を細く。同じ層で別の部品に重なる所だけ細い内側の線。線色は素材ごと。線幅は `PV.anime.inkW(画面上の頭の高さ)`。
- **セル塗り**：ベタ＋光と反対側の1影の帯（くっきり）＋設計した影（襟・リボンの落ち影、裾が太ももに落とす影、顎が首に落とす影、袖が胴に落とす影、プリーツ、肘の内側）＋艶のある素材のハイライト帯。
- **リムライト**（`LIGHT[*].rimA` > 0）：頭ライブラリと同じ方式＝**人物の合成シルエットの内側に光側の帯 1 本**（シルエットを作る部品の合成 − 光と反対へずらした合成、等倍、人物の範囲だけ）。体の前を通る腕・袖・手の縁には出ない。旧方式（部品ごと）は `o.partRim:true`。
- **暗い照明**：肌は頭と同じ `PV.anime.faceLight`（アンビエントを下げ露出を上げる）、服はその 75%（`o.clothLift`）。夜・嵐でも色と線が残る。
- **2コマ打ち**：ポーズの揺れ・呼吸・布・走り／歩きは `PV.anime.onTwos(T)`。決定論的（同じフレームを2回描いて差分 0）。
  **シーンから与える値（`lean`, `look`, `progress`, `sip` など）も `PV.anime.onTwos(T)` から計算すること**（ショーケースはそうしている）。

## 2. `PV.anime.figure(ctx, o)` — 1人
| 引数 | 既定 | 説明 |
|---|---|---|
| `who` | `'senpai'` | `'senpai'`（7.0頭身、161cm）／`'boy'`（7.3頭身、178cm、肩幅≒1.8頭）／`'aunt'`（7.2頭身） |
| `outfit` | 人物ごと | §4 |
| `pose` | `'stand'` | §5 |
| `x, y` | 0, 0 | **アンカー**（ポーズごと：立ち＝両足の間の地面、座り＝座面、膝立ち＝膝の下の床、走り・歩き＝骨盤の真下の地面） |
| `scale` | 100 | **頭1つ分の px**（あご〜頭頂）。`PV.anime.bodyScale(who, 身長px)` で身長から逆算 |
| `facing` | ポーズごと | `'front'`, `'3q_right'`, `'right'`, `'3q_back_right'`, `'back'`, `'3q_back_left'`, `'left'`, `'3q_left'`、または数値（rad。+π/2＝画面右向きの横顔）。`'3q_right'` は人物が画面右を向き、**彼女の右側**が見える |
| `camPitch` | 0 | 見下ろし(+)/見上げ(−)（rad、正射影）。**頭にも効く**。座る・弾く・寝る絵は 0.15〜0.3 推奨 |
| `T` | 0 | 全体の秒 |
| `light` | `'day'` | `PV.anime.LIGHT` の名前 |
| `keyDir` / `rimDir` | −2.3 / keyDir | 主光／逆光の方向（rad、人物→光、画面座標） |
| `rimA`, `rimColor`, `amb` | 照明どおり | リムの強さ・色／全素材の amb を固定（上書き） |
| `faceLift`, `clothLift` | 照明ごと / 0.75 | 暗い照明での持ち上げ（肌＝`faceLight` の lift、服＝その割合） |
| `wet` | 0 | 0..1 濡れ。`outfit:'wet'` は自動で 1 |
| `wind`, `windDir` | 0, 0 | 風（0..2）と風下の方向。`pose:'run'` は未指定なら走る向きと逆に自動 |
| `head` | {} | `PV.anime.head` にそのまま渡す（`expr, eyes, mouth, talk, brows, blush, hair, …`）。加えて `turn`（首からの追加回転、yaw 単位）、`yaw / pitch / roll / back`（絶対値で上書き）、`sizeK` |
| `params` | {} | ポーズ固有（§5） |
| `costume` | — | 衣装フラグの部分上書き（例 `{ ribbon:false, earphones:false }`） |
| `alpha`, `flip`, `line`, `noHat` | | 1未満はオフスクリーン合成／左右反転（ギプスの衣装では使わない）／線幅倍率／帽子を描かない |
| `bodyNeck`, `partRim` | false | 頭ライブラリの首の代わりに体の首を描く／旧方式の部品ごとのリム（どちらも比較・デバッグ用） |
| `head.neckW` | 1 | 頭ライブラリの首の太さの倍率（頭ライブラリの設定どおりなら指定不要） |

戻り値：`{head, neck, hands:{L,R}（手首）, shoulders:{L,R}, pelvis}`（ctx 座標）。

**描画順**（1人の中）：`headBack` → 小物（奥）→ 奥の腕 → 脚 → 小物（中）→ 体（首・胴・スカート・上着・バッグ・イヤホン・手前の腕）→ 小物（手前：鍵盤蓋、毛布）→ `head({…, layer:'front'})` → 顔の前に来る手。

## 3. `PV.anime.pair(ctx, o)` — 2人
共通の「ペア空間」（先輩の頭単位）に置き、`facing` でペアごと回す。彼は先輩の頭の **1.06 倍**で描く（決定稿 1-2：彼の身長 7.7 単位、素足の先輩の頭頂が彼の鼻先）。
引数は figure と同じ（`facing, camPitch, T, light, rimDir, wind, alpha` は2人に共通）＋ `params` ＋人物ごとの `senpai:{…}`, `boy:{…}`（`outfit, head, params, wet, scaleK`）。戻り値 `{senpai, boy}`。

| ペア | 既定の向き | params | 用途 |
|---|---|---|---|
| `sit_side` | `'3q_left'` | `side` `'left'`（先輩が彼の左＝C22/C42）/`'right'`（C33）、`gap`（C33 は 1.0）、`lean` 0..1（肩に頭）、`look` 0..1（彼に顔を向ける）、`seat` `'grass'`/`'sofa'`、`sofa`（描く）、`blanket`（毛布、C35）、`boyLook`, `boyNod`、`herKnees`（芝生の先輩の脚：既定 `'side'`＝**横座り**、脚は彼と反対へ。`'up'`＝膝を抱える） | C22・C33・C42 は**同じ数値のカメラ**（例 `facing:-0.42, camPitch:0.2`）。芝生の彼は**片膝を立てて腕を乗せる**。C35 は彼女の側から（例 `facing:0.3, side:'right', gap:0, lean:1, blanket:true`） |
| `embrace` | **−0.75**（彼の前左） | `progress` 0..1、`headSide`（−1 既定。+1 は鏡像、その時は `facing:+0.75`） | C32：彼女は彼の肩に顎をのせて**カメラ側へ顔を向け**、彼の決意の顔は反対の肩越し。二人の顔が読める |
| `leap_embrace` | **−0.75** | `progress`（既定 0.3：飛び込んだ瞬間、脚が跳ね上がり彼はのけぞる） | C20 の着地。駆け寄りは `figure(pose:'run', facing≈0)` |
| `collapsed` | `'right'` | `rise` 0..1、`sob`, `headUp`, `boyArms` | C31（遠景用。顔は寄りの頭／バストで） |

## 4. 衣装（`outfit`）— `character_design_from_text.md` どおり
| 人物 | 名前 | 内容 |
|---|---|---|
| 先輩 | `uniform` | 白の長袖ブラウス、赤いリボン（蝶結び）、紺のプリーツ（膝丈）、紺のハイソックス、**上履き（つま先が赤）**。ピアノでは袖口を一つ折る |
| | `summer_uniform` | 半袖ブラウス＋リボン＋紺スカート、上履き（C13 文化祭） |
| | `blazer` | 制服＋紺ブレザー、焦げ茶のローファー（登下校） |
| | `dress` | 濃紺：控えめな丸首、キャップスリーブ、**膝下**、同色の細いベルト、紺の低いパンプス、**銀**の細いチェーン。髪は自動で `updo` |
| | `dress_cardigan` | ドレス＋**生成り**のカーディガン（前開き、リブ）。髪は `loose` |
| | `summer` | 白の半袖ワンピース（小さな丸首、飾りなし、膝下のAライン）、**革のフラットサンダル**、キャメルの小さなショルダーバッグ（斜め掛け）、帽子（頭ライブラリが描く） |
| | `gown` | 淡い水色のパジャマ型病衣、**ギプス（上腕の中ほど〜指の付け根の手前、肘90°、親指も覆う）＋白い三角巾**、スリッパ |
| | `home` | 首回りの広いゆったりした灰色のニット（袖は指の付け根まで）、**くるぶし丈**のスカート、スリッパ（C33〜C40） |
| | `out_brace` | 沈黙の日々の外出：`home`＋**紺のアームスリング**（右前腕を袋で吊る）、焦げ茶の靴（決定稿 out_brace） |
| | `spring2` | 2年目の春（C41）：ブラウス＋生成りのカーディガン、**紺のアームスリング（右前腕を袋で吊る）** |
| | `ending` | 終章（C42）：白いワンピース＋生成りのカーディガン、ネックレス、アームスリングなし |
| 彼 | `uniform` | 白シャツ（第一ボタンを外す）、緩めた**深緑**のネクタイ、袖まくり、ベルト、チャコールのズボン、**上履き（つま先が深緑）**、首に有線イヤホン |
| | `summer_uniform` | 袖まくり、ネクタイなし、首元を開ける（C13/C14） |
| | `blazer` | ＋紺ブレザー（前を開ける、**ノッチドラペル**）、ローファー |
| | `tee` | 白T＋前を開けた水色の**半袖**シャツ（袖の折り返し、**襟は肩に開いて寝る**）、チャコールのパンツ、白いスニーカー（C15/C19） |
| | `jacket` | 黒T＋焦げ茶の革ジャン、ジーンズ、**黒いブーツ**、首にイヤホン |
| | `wet` | 雨で張りつく白シャツ（**透けない**、引っ張りじわ）、濡れたズボン、髪は `wet` |
| | `ending` | 白い無地のシャツ（袖まくり）、チャコールのパンツ、スニーカー（C42） |
| | `year2` | **沈黙の日々（C33〜C40）**：無地の灰色の長袖 T シャツ、ジーンズ、スニーカー（決定稿 3-3。海の `tee` はこの場面には使わない） |
| | `year2_black` | 2 年目の初夏：黒の半袖 T、ジーンズ |
| 叔母 | `coat` | **チャコール**の薄手のロングコート（膝下、ベルトなし、**長い V のラペル**）＋黒のニット、黒タイツ、ショートブーツ、肩に小さなバッグ |

追加した素材（`PV.anime.COLORS` に**未定義の時だけ**足す。`anime.js` は変更していない）：
`shirt_blue, tee_black, jeans, belt, buckle, sole, sneaker, slipper, chain, wood, steel, lacquer, cushion, carton, carton_band, straw, sofa, strap, rosewood, maple, guard, chrome, rail, grass, tights, boot, pumps, sandal, bandage, pajama_pants, long_skirt, turtle, piping, sash, sling, ivory, ebony, uwabaki, toe_red, toe_green, coat_charcoal, blanket, bag_camel, bag_black, cable, brace_navy`。
DESIGN_PATCH（`anime.js` の DESIGN / COLORS）の素材 `necklace`（銀のチェーン）・`brace`（紺の装具）・`tie`（深緑）・`cardigan`（生成り）を使う。

## 5. ポーズ（`pose`）
| ポーズ | アンカー | 既定の向き | params | 用途 |
|---|---|---|---|---|
| `stand` | 両足の間の地面 | front | `weight` −1..1（コントラポスト：腰が上がり肩が逆に傾く、遊脚の膝が入る）、`armBend`（0.2）、`arms` `'relax'`/`'chest'`/`'behind'`/`'bow'`/`'cover'`/`'reach'`/`'pocket'`/`'strat'`/`'keys'`（**61 鍵のステージキーボード＋X スタンドを自動で描く**。`keyboard:false` でシーンの楽器を使う）、`bow`, `nod`, `tilt`, `neckYaw`, `twist`, `stance` | 型紙、C13、C25 |
| `walk` | 骨盤の真下の地面 | front | `speed`（0.85 周期/秒）、`phase`, `stride`（0.55）、`neckYaw` / `twist`（肩越しに振り向く）、`arms:'bag'` | **C36**：`facing:-2.55, params:{neckYaw:1.2, twist:0.35}` |
| `piano` | ピアノ椅子の座面の中央 | 3q_right | `intensity` 0..1、`play`, `hands` `'keys'`/`'lap'`/`'lift'`、`look` `'keys'`/`'ahead'`/`'up'`、`breathe`, `lean`, `tilt`, `neckYaw`、`bench`、**`keys`（鍵盤、既定 true。シーンのピアノを使う時は false）**、`keysLeft/keysRight`（鍵盤の長さ、既定 2.65＝88鍵）、`desk`（譜面台）、`keyH`（1.0）, `keyZ`（1.12）, `benchH` | 顔＋手が見えるのは**高音側の端から**（`facing≈1.05, camPitch≈0.3`）、**右の横顔**（`'right'`）、**正面の上から**（`camPitch≈0.4`）。正面・斜め前の目の高さでは鍵盤蓋が手を隠す（実物どおり） |
| `seated_chair` | 学校の椅子の座面 | 3q_left | `variant` `'idle'`/`'juice'`（`sip`）/`'clap'`（`claps:[秒…]`、みぞおちの前で小さく）/`'guitar'`（音楽室のアコースティック、`strum`, `headDown`）、`chair`, `seatH`, `slump`, `nod`, `tilt`, `neckYaw` | C02/C04/C06/C12 |
| `kneel_guitar` | 膝の下の床 | 3q_left | `variant` `'raise'`/`'down'`、`look` | C14 |
| `run` | 骨盤の真下の地面 | 3q_left | `speed`（1.4）、`phase`, `stride`（ヒールなら 0.75）、`style`, `arms:'open'` | **C20：カメラに向かって** `facing≈-0.25` |
| `railing` | 両足の間の地面 | 3q_left | `variant` `'lean'`/`'hat'`/`'hold'`、`railing`（描く）, `railH`, `railZ`, `railMat`, `turn`, `tilt`, `neckYaw` | C15（`'right'` で帽子の下の横顔、`facing≈0.95` で帽子を押さえる斜め前）、C27（`turn:-0.5` で顔を向ける） |
| `sit_ground` | 腰の真下の地面（ソファの座面） | 3q_left | `knees` `'up'`/`'cross'`/`'out'`/`'one'`（片膝立て、`upSide`）/**`'side'`（横座り：両膝を前に、脛を片側へ畳む。`sideDir` +1＝本人の左）**、`arms` `'knees'`/`'prop'`/`'lap'`/`'hug'`/`'kneeRest'`、`lean`/`leanDir`, `look`, `sofa`, `seatH`, `blanket`, `armL/armR` | sit_side の部品。膝を立てた時のスカートは膝から垂れ、横は地面まで落ちる（太ももの裏が見えない） |
| `lie_back` / `kneel_up` | | | （C31/C30 の遠景用） | |
| `hug` | 両足の間の地面 | front | `partner`, `WL/WR`（手の位置を体の座標で直接指定）, `poleL/poleR`, `handL/handR`, `headSide`, `headYaw`, `tilt`, `side`, `lift`, `kick`, `leanBack` | embrace の部品 |

## 6. 小物（ポーズ・衣装が自動で描く）
ピアノ椅子、**鍵盤**（白鍵の面と目地、黒鍵、口棒、拍子木、鍵盤蓋、任意で譜面台。奥行きで手の下／前を切り替え）、**ステージキーボード**（`arms:'keys'`）、学校の椅子、**紙パックのジュース**（色の胴＋白い帯とラベル＋ストロー）、アコースティック（傷なし）、白いストラト（塗装の剥げ）、ソファ、手すり、**毛布**（C35：肩と腕を包むショール、前は手元まで開く＋膝に掛かる端）、**ショルダーバッグ**（夏：キャメル斜め掛け、叔母：黒）、**有線イヤホン**（彼）、**ギプスと三角巾**、**紺のアームスリング**、上履き（学年色のつま先）、サンダルの革紐。

## 7. 性能（`dev_anime_body_perf*`：10体 − 0体、CPU は別作業と共有、8 フレームの中央値）
- 本物の頭（首を含む）を含む全身・順光：**先輩 25 ms／人、彼 26 ms／人、ピアノ＋鍵盤 27 ms／人**（頭 120px）。予算 30 ms 以内。
- **逆光**（`window` など `rimA` > 0）：約 **44 ms／人**＝体 24.5 ＋体のリム 3 ＋**頭のリム約 17**（`perfN` / `perfH` / `perfX`）。頭のリムは頭ライブラリの課題（統合講評 H7）。
  重い時は遠景の人物に `head:{ rim:0 }`（頭のリムなし）か `rimA:0`（体のリムなし）。
- 決定論：同じフレームを別セッションで2回描いてバイト一致。揺れ・布・リムはすべて `onTwos(T)` から。

## 8. ショット別の使い方（`analysis/anime_shot_plan.md` に対応）
```js
const A = PV.anime, tq = A.onTwos(T);
// C02/C04/C10 ピアノ：高音側の端から3/4（顔＋手）。シーンのグランドピアノを使う時は keys:false
A.figure(ctx, { who:'senpai', pose:'piano', facing:1.05, camPitch:0.3, x, y, scale, T, light:'window', rimDir:-0.5,
  params:{ intensity:0.9, keys:false }, head:{ expr:'focus', brows:{ furrow:0.6 } } });
// C17 右の横顔（ドレス）
A.figure(ctx, { who:'senpai', outfit:'dress', pose:'piano', facing:'right', camPitch:0.08, x, y, scale, T, light:'stage', params:{ intensity:0.6 }, head:{ expr:'focus' } });
// C13 舞台：キーボード（自動でスタンド付きのシンセを描く）とストラト
A.figure(ctx, { who:'senpai', outfit:'summer_uniform', pose:'stand', facing:'3q_right', x, y, scale, T, light:'spot', rimDir:-1.6, params:{ arms:'keys', weight:0.2 }, head:{ expr:'determined' } });
// C04 奥の彼：小さく拍手（顔が見える）／C06・C02 ジュース
A.figure(ctx, { who:'boy', pose:'seated_chair', facing:'3q_left', x, y, scale, T, light:'window', params:{ variant:'clap', claps:[10.6, 11.1, 11.6] } });
// C12 ギターを膝に俯いて泣く彼
A.figure(ctx, { who:'boy', pose:'seated_chair', facing:'3q_left', x, y, scale, T, light:'window', params:{ variant:'guitar', headDown:0.15 }, head:{ expr:'cry', talk:true } });
// C15 手すり：帽子の下の笑う横顔（風）
A.figure(ctx, { who:'senpai', outfit:'summer', pose:'railing', facing:'right', x, y, scale, T, light:'summer', wind:1, windDir:3.0, params:{ variant:'lean' }, head:{ expr:'smile' } });
// C20 カメラに向かって駆けてくる → 飛び込む
A.figure(ctx, { who:'senpai', outfit:'dress_cardigan', pose:'run', facing:-0.25, x, y, scale, T, light:'night', rimDir:-2.6, params:{ stride:0.75 }, head:{ expr:'smile' } });
A.pair(ctx, { pose:'leap_embrace', x, y, scale, T, light:'night', params:{ progress:PV.smooth(64.8, 65.2, tq) }, senpai:{ outfit:'dress_cardigan', head:{ expr:'smile' } }, boy:{ outfit:'uniform', head:{ expr:'surprise' } } });
// C22 / C33 / C42 — 同じカメラ
const CAM = { facing:-0.42, camPitch:0.2 };
A.pair(ctx, { pose:'sit_side', ...CAM, x, y, scale, T, light:'night', params:{ side:'left', lean:PV.smooth(73.6, 74.4, tq) }, senpai:{ outfit:'dress_cardigan', head:{ expr:'closed' } }, boy:{ outfit:'uniform' } });
A.pair(ctx, { pose:'sit_side', ...CAM, x, y, scale, T, light:'room_gray', params:{ side:'right', gap:1.0, seat:'sofa' }, senpai:{ outfit:'home', head:{ expr:'empty', talk:true } }, boy:{ outfit:'year2' } });
A.pair(ctx, { pose:'sit_side', ...CAM, x, y, scale, T, light:'sunset', rimDir:-0.3, params:{ side:'left', look:PV.smooth(167.7, 168.3, tq) }, senpai:{ outfit:'ending', head:{ expr:'gentle' } }, boy:{ outfit:'ending' } });
// C35 毛布にくるまって肩で眠る（彼女の側から。二人の顔を入れるなら 0.2〜0.35）
A.pair(ctx, { pose:'sit_side', facing:0.3, camPitch:0.2, x, y, scale, T, light:'room_gray', params:{ side:'right', gap:0, seat:'sofa', lean:1, blanket:true }, senpai:{ outfit:'home', head:{ expr:'sleep' } }, boy:{ outfit:'year2', head:{ talk:true } } });
// C32 雨の抱擁：二人の顔
A.pair(ctx, { pose:'embrace', x, y, scale, T, light:'storm', rimDir:-2.2, senpai:{ outfit:'gown', wet:1, head:{ expr:'surprise', hair:{ style:'wet' } } }, boy:{ outfit:'wet', head:{ expr:'determined', talk:true } } });
// C36 去りながら肩越しに振り向く叔母
A.figure(ctx, { who:'aunt', outfit:'coat', pose:'walk', facing:-2.55, x, y, scale, T, light:'window', rimDir:-0.6, params:{ neckYaw:1.2, twist:0.35 }, head:{ talk:true, eyes:{ open:0.8 } } });
// C27 嵐の欄干：顔をこちらへ
A.figure(ctx, { who:'senpai', outfit:'gown', pose:'railing', facing:'right', x, y, scale, T, light:'storm', wet:1, params:{ variant:'hold', turn:-0.5 }, head:{ expr:'cry', hair:{ style:'wet' } } });
```

## 9. 既知の弱点（正直に）
- **腕のポーズはまだ硬い所がある**：抱擁や拍手のように両腕を体の前で使う絵では、袖（特に濡れたシャツの細い袖）が素直な管に近い。曲げた肘のしわ・肘頭は入ったが、手首の返しや指の表情は少ない。
- **手**は5形（甲・手のひら・親指側・小指側・拳）の簡略な手。頭 150px 以上の寄りでは物足りない。手元のアップは `hands.js`。
- **ピアノ**：正面・斜め前の目の高さでは鍵盤蓋が手を隠す（実物どおり）。顔と手を同時に見せるのは「高音側の端から」「横から」「上から」。シーンで `instruments.js` のグランドピアノを使う場合は `keys:false` にし、鍵盤の高さ・奥行きを `keyH / keyZ` で合わせる。
- **走り**は正面からは早歩きに近い（脚の運びが奥行き方向に縮むため）。髪・スカートの風で補う。全力疾走はない。
- `collapsed` / `kneel_up` / `lie_back` は遠景用の精度。C31 の顔は頭／バストの寄りで。
- 革ジャンのスタンドカラーは首輪に近く見える。（彼のブレザーと叔母のコートはノッチドラペルに直した。）
- ペアの接触（肩に頭、背中の手）は目で合わせた値。体格や向きを大きく変えると手が浮く／めり込むことがある。
- 帽子は頭ライブラリの描画（横からは、つばが円盤に見え、つばの影が目の高さの帯になる。統合講評 H1）。
- 長い髪（後ろ姿・横顔の「黒いマント」）は頭ライブラリの課題（統合講評 H2）。横顔・後ろ向きで頭ライブラリが後ろ髪を前レイヤーに置くので、体は**髪より手前の腕を頭の後にもう一度描く**（`nearArmOverHair`）。
- 二人の抱擁（C32）と飛び込み（C20）はミディアムまで。腕が背中へ回り込む厚みがなく、手は大きな平板。飛び込みは「彼の顔（`facing≈-0.75`）」か「蹴り上げ（`≈-1.2`）」のどちらか。
- 横座り（`knees:'side'`）は斜め前・正面から作った。真横からは脚の重なりが分かりにくい。

## 10. シーンへの組み込みガイド（次の段階：シーンファイルから人物を呼ぶ時の約束）

統合レビュー（`anime_integration_review.md`）の結果から。確認用の等倍の作例は `dev_anime_body_shots1`〜`6`・`pairs1`・`2`（各セル＝本番フレームの等倍の切り抜き）。

### 10-1 何を呼ぶか
| 画 | 呼ぶもの | 理由・注意 |
|---|---|---|
| 1人が全身〜膝上（引き・ミディアム）、手や小物が映る寄り | `PV.anime.figure` | 頭・首・体・衣装・小物・リムを正しい順で描く（`headBack` → 体 → `head` 前レイヤー → 髪より手前の腕 → 頭より手前の手） |
| 2人が触れている（肩に頭・抱擁・飛び込み・並んで座る・倒れ込み） | `PV.anime.pair` | 共通の空間・身長比（彼の頭 1.06）・2人の間の描画順をライブラリが持つ |
| 2人が離れている（C02/C04 ピアノと椅子、C12、C13 舞台、C15 手すり、C36 は1人） | `figure` を2回 | **奥から先に**描く。同じ距離なら彼の `scale` は彼女の **×1.06**、叔母は **×0.99** |
| 胸から上の寄りで、腕のポーズが要らない（C05, C16, C28, C39 の寄り） | `figure` を寄りの `scale` で（フレームで切る）を推奨。`PV.anime.bust` も可 | `figure` なら引き・ミディアムと同じ首・襟・リボン・ギプスになる（作画の一貫性）。`bust` は簡易な胴（腕なし）だが首と顔は同じ |
| 顔だけ（C30 の見上げ、C31 の地面すれすれの2人、頭 300〜600 px のアップ） | `PV.anime.head`（体がフレーム外なら `neck:true`） | `collapsed` / `lie_back` / `kneel_up` はミディアムではマネキンに見える。C31 は2つの頭で組む |

### 10-2 大きさ（`scale`＝頭の高さ px。体と頭は同じ単位）
| 画の種類 | 全身の高さ | 先輩の `scale` | 備考 |
|---|---|---|---|
| 引き | 250〜450 px | 36〜64 | 目と光が読める下限は頭 ≈34 px（C02 の奥の彼） |
| ミディアム | 700〜1000 px | 100〜150 | 座った人物は約 4.3 頭分の高さ |
| 寄り（胸から上） | （フレーム外） | 190〜260 | 首の点の位置で置く（下記） |
| アップ | — | 300〜600 | `head` / `bust` |

- 身長から：`PV.anime.bodyScale(who, 高さpx)`。2人並びは彼女の `scale` を基準に、彼 ×1.06、叔母 ×0.99。
- アンカー（`x, y`）：立ち・手すり＝両足の間の地面、座り＝座面、ピアノ＝椅子の座面、走り・歩き＝骨盤の下の地面、膝立ち＝膝の下の床。
- **寄りの置き方**：首の点はアンカーから約 `(H − 0.88) × scale` 上（立ち：先輩 6.12、彼 6.42、叔母 6.32 頭。椅子・ピアノ：座面から約 2.4 頭）。
  例：首の点を画面の y=313 に置く先輩の寄り（scale 230。顔はおよそ y=110〜340）→ `y = 313 + 6.12*230 ≈ 1720`（`dev_anime_body_shots6` の C05）。

### 10-3 照明と向き
| ショット | `light` | `rimDir`（人物→光、画面のラジアン：0 右、−π/2 上、π 左） | 頭の追加 |
|---|---|---|---|
| C02〜C12 音楽室 | `window` | 窓の方へ（例 −0.5 ＝右上） | 逆光の寄りは頭 API の `shade` 0.55〜0.65 |
| C13/C14 体育館 | `spot` | −1.6（真上） | |
| C15 海 | `summer` | 太陽の方へ | `wind:1, windDir:3.0`（顔の前から吹き、髪とスカートは後ろへ） |
| C16/C17 コンクール | `stage` | （順光） | 寄りは `S.post={bloom:0.15〜0.2}` |
| C20/C22 夜の公園 | `night` | −2.6（左上の夜景） | |
| C25 病室 | `hospital` | 窓の方へ | |
| C27〜C32 嵐 | `storm`（雷の瞬間 `lightning`） | −2.2 | 濡れ髪は風で横へ（`hair:{style:'wet', wind:0.8〜1.2}`） |
| C33/C35 沈黙の日々 | `room_gray` | （順光） | |
| C36 叔母 | `window`（戸口の暖色の逆光） | 戸口の方へ（例 −0.6） | |
| C39 | `lamp` | −0.3（街灯） | 頭 API C39 の注記どおり |
| C42 | `sunset` / `golden` | −0.3 | 頭 `rimW` 1.5〜2 |

- 向き：`facing` は `'front'` 0、`'3q_right'` π/4（画面右を向き**彼女の右側**が見える）、`'right'` π/2、`'back'` π、`'3q_left'` −π/4。数値でも可。
- **C22・C33・C42 は同じカメラ**：`facing:-0.42, camPitch:0.2`（並びの変化＝左に寄り添う／右に隙間／左に戻る、を同じ構図で読ませる）。
- 座る・弾く・寝る絵は `camPitch` 0.15〜0.3（頭にも効く）。ギプス・アームスリングの衣装で `flip` は使わない（右腕が入れ替わる）。
- 性能：逆光の全身は 1 体約 44 ms（頭のリム約 17 ms）。遠景・群像では `head:{ rim:0 }` で頭のリムを切る。

### 10-4 時間
- `T` は**全体の秒**（`env.T`）を渡す（瞬き・口パク・揺れ）。台詞の口パクは `head:{ talk:true }`（`PV.anime.mouth(T, who)`＝本物の台詞の音量）。ショット内の時刻 `t` を渡すと口が合わない。
- シーンから与える値（`lean`, `look`, `progress`, `sip`, 拍手の `claps` 以外の補間）は `PV.anime.onTwos(T)` から計算する（2コマ打ち）。カメラは 24fps のまま。

### 10-5 小物と背景の取り合い
- ピアノ：体ライブラリの鍵盤は簡易。`instruments.js` のグランドピアノを使う時は `params:{ keys:false }` にし、鍵盤の高さ・奥行きを `keyH / keyZ` で合わせる。顔と手が同時に見えるのは「高音側の端から（`facing≈1.05, camPitch≈0.3`）」「横から（`'right'`）」「上から」。
- C13 のキーボードは `arms:'keys'` で自動（シーンの楽器を使うなら `keyboard:false`）。ストラトは `arms:'strat'` / `kneel_guitar`。
- 椅子・ピアノ椅子・ソファ・手すりは簡易な箱（`chair:false` / `bench:false` / `sofa:false` / `railing` 省略で消し、背景美術で描く）。人物はアンカーを合わせるだけ。
- 字幕（下）・縦書きテロップ（右）に顔をかけない。寄りの顔は画面の上 2/3、左寄りが安全。

### 10-6 ショット別の呼び方（作例は `dev_anime_body_shots*` / `pairs*`）
| ショット | 呼び方（要点） |
|---|---|
| C02/C04 | 先輩 `figure(pose:'piano', facing:1.05, camPitch:0.3, scale≈58, light:'window', params:{intensity:0.9, keys:false}, head:{expr:'focus', brows:{furrow:0.6}})`＋奥の彼 `figure(pose:'seated_chair', facing:'3q_left', scale≈36, params:{variant:'juice'|'clap', claps:[10.6,11.1,11.6]})` |
| C05 | 寄り：`figure(pose:'stand', facing:0.55, scale≈230, params:{tilt:0.12}, head:{expr:'teary', talk:true, eyes:{tears:0.5}})` |
| C06 | 寄り：`figure(who:'boy', pose:'seated_chair', facing:-0.6, scale≈190, params:{variant:'juice', sip:…}, head:{expr:'gentle', talk:true})` |
| C10 | `figure(pose:'piano', facing:1.05, camPitch:0.28, scale≈150, params:{intensity:0.35, keys:false}, head:{expr:'closed'})` |
| C12 | 先輩 `figure(pose:'stand', facing:'3q_left', params:{arms:'chest'})`、彼 `figure(pose:'seated_chair', params:{variant:'guitar', headDown:0.15}, head:{expr:'cry', talk:true})`（同じ `scale` 系、彼 ×1.06） |
| C13 | 先輩 `outfit:'summer_uniform', params:{arms:'keys'}`、彼 `outfit:'summer_uniform', params:{arms:'strat'}`、`light:'spot'` |
| C14 | `figure(who:'boy', outfit:'summer_uniform', pose:'kneel_guitar', params:{variant:'raise'}, head:{expr:'closed', mouth:{open:0.5}})` |
| C15 | 2人とも `pose:'railing', facing:'right', params:{variant:'lean', railing:false}`（手すりは背景）、`wind:1, windDir:3.0`。写真（C19）は2人の寄りを正面で |
| C16 | 寄り：`outfit:'dress'`（髪は自動でアップ）、`head:{expr:'neutral', eyes:{shine:0.35, look:[0.25,0.1]}}` → 咳払いで `shine:1, blush:0.3` |
| C17 | `figure(outfit:'dress', pose:'piano', facing:'right', camPitch:0.06, scale≈150, light:'stage', params:{intensity:0.75, keys:false}, head:{expr:'focus', brows:{furrow:0.7}})` |
| C20 | 走り `figure(outfit:'dress_cardigan', pose:'run', facing:-0.25, params:{stride:0.75}, head:{expr:'smile'})` → 64.8 秒から `pair('leap_embrace', params:{progress:PV.smooth(64.8, 65.2, tq)})`（彼の顔：`facing≈-0.75`／蹴り上げ：`≈-1.2`） |
| C22 | `pair('sit_side', facing:-0.42, camPitch:0.2, params:{side:'left', lean:…}, senpai:{outfit:'dress_cardigan', head:{expr:'closed'}}, boy:{outfit:'uniform'})`（先輩は横座り） |
| C25 | `figure(who:'boy', pose:'stand', facing:-0.25, scale≈150, light:'hospital', head:{expr:'pain', talk:true})`＋シーン側のボケ |
| C27/C28 | `figure(outfit:'gown', pose:'railing', facing:'right', wet:1, params:{variant:'hold', turn:-0.5}, head:{expr:'cry'|'shout', hair:{style:'wet', wind:1}})`、寄りは `stand` の寄り |
| C30/C31 | 頭（`head`）で組む：下から見上げる泣き叫ぶ顔（`pitch` 負）／地面すれすれの彼の顔（`talk:true`）＋覆いかぶさる彼女の顔 |
| C32 | `pair('embrace', facing:-0.75, camPitch:0.06, light:'storm', senpai:{outfit:'gown', wet:1, head:{expr:'surprise', eyes:{tears:0.6}}}, boy:{outfit:'wet', head:{expr:'determined', talk:true}})`（ミディアムまで。寄りは2つの頭） |
| C33 | `pair('sit_side', facing:-0.42, camPitch:0.2, params:{side:'right', gap:1, seat:'sofa'}, senpai:{outfit:'home', head:{expr:'empty', talk:true}}, boy:{outfit:'year2'})` |
| C35 | `pair('sit_side', facing:0.3, camPitch:0.2, params:{side:'right', gap:0, seat:'sofa', lean:1, blanket:true}, senpai:{outfit:'home', head:{expr:'sleep'}}, boy:{outfit:'year2', head:{talk:true}})` |
| C36 | `figure(who:'aunt', outfit:'coat', pose:'walk', facing:-2.55, params:{neckYaw:1.2, twist:0.35}, head:{talk:true, eyes:{open:0.8}})` |
| C39 | 寄り：`figure(who:'boy', outfit:'year2_black'|'year2', pose:'stand', facing:'left', scale≈240, light:'lamp', params:{nod:0.3}, head:{expr:'cry', talk:true})` |
| C42 | `pair('sit_side', facing:-0.42, camPitch:0.2, light:'sunset', rimDir:-0.3, params:{side:'left', look:PV.smooth(167.7, 168.3, tq)}, senpai:{outfit:'ending', head:{expr:'gentle'}}, boy:{outfit:'ending'})` |
