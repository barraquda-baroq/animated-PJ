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

顔・髪は `anime_head.js`（`PV.anime.head / headBack`、別担当）を **HEAD API の通りに** 呼ぶ。未ロード／例外時だけ簡易な代用の頭を描く。

## 1. 仕組み（ポリゴン・マネキンに見えないための作り）
- **3D なのは骨格だけ**：関節位置（IK）、楕円リングを積んだ胴（ロフト）、リングから垂らすスカート。見える物はすべて、投影した骨格から作る**なめらかな2D図形**で、面ごとの陰影や全身の3Dグラデーションはない。
- **手足は解剖の断面プロファイル**：腕・脚とも `[f, 外, 内, 前, 後ろ]` の半幅（`SPECS.upA / foreA / thighW / shinW`）。画面に見えている側の幅を混ぜるので、三角筋の張り・二の腕・肘のくびれ・前腕の膨らみ・平たい手首、太もも・膝・ふくらはぎ・足首の起伏がどの向きでも出る。
  先輩：上腕 0.24H、肘 0.15H、前腕 0.18H、手首 0.12H、太もも上端 0.47H、膝 0.24H、ふくらはぎ 0.27H、足首 0.14H（H＝頭の高さ）。
- **関節は1本の輪郭**（`limb2`）：内側は2本の輪郭の交点で折り、外側は**長さ制限つきのマイター（肘頭・膝頭の丸い尖り）**。球体関節の円弧は使わない。
- **首**：付け根（胸の座標、首の付け根から僧帽筋へ広がる）→ 中間 → 上端（首の座標）の3リングのロフト。上端のリングは**斜め**（うなじ側が高く、喉側が低い）で頭の中に隠れる。首は前傾（`SPECS.neckFwd`）、付け根と全ての襟ぐりは**後ろが高い**（`NECK_TILT`、C7 は喉のくぼみより高い）。うなずきは首 55%／頭 45%。
- **頭の向き**：首の座標系 `J.Mn` をカメラ行列（向き＋`camPitch`）で分解して HEAD API の yaw / pitch / roll を作る。カメラの伏角は顔にも効き、横顔では首の前傾が「頭の傾き」にならない。`o.head.yaw / pitch / roll / turn` で上書きできる。
- **主線**：同じ奥行きの層の部品は1本の外形線を共有（塗りの後ろに描くストローク）。光と反対側を太く、光側を細く。同じ層で別の部品に重なる所だけ細い内側の線。線色は素材ごと。線幅は `PV.anime.inkW(画面上の頭の高さ)`。
- **セル塗り**：ベタ＋光と反対側の1影の帯（くっきり）＋設計した影（襟・リボンの落ち影、裾が太ももに落とす影、顎が首に落とす影、袖が胴に落とす影、プリーツ、肘の内側）＋艶のある素材のハイライト帯＋逆光（`LIGHT[*].rimA`）では `rimDir` 側にリムの帯。
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

戻り値：`{head, neck, hands:{L,R}（手首）, shoulders:{L,R}, pelvis}`（ctx 座標）。

**描画順**（1人の中）：`headBack` → 小物（奥）→ 奥の腕 → 脚 → 小物（中）→ 体（首・胴・スカート・上着・バッグ・イヤホン・手前の腕）→ 小物（手前：鍵盤蓋、毛布）→ `head({…, layer:'front'})` → 顔の前に来る手。

## 3. `PV.anime.pair(ctx, o)` — 2人
共通の「ペア空間」（先輩の頭単位）に置き、`facing` でペアごと回す。彼は先輩の頭の **1.06 倍**で描く（決定稿 1-2：彼の身長 7.7 単位、素足の先輩の頭頂が彼の鼻先）。
引数は figure と同じ（`facing, camPitch, T, light, rimDir, wind, alpha` は2人に共通）＋ `params` ＋人物ごとの `senpai:{…}`, `boy:{…}`（`outfit, head, params, wet, scaleK`）。戻り値 `{senpai, boy}`。

| ペア | 既定の向き | params | 用途 |
|---|---|---|---|
| `sit_side` | `'3q_left'` | `side` `'left'`（先輩が彼の左＝C22/C42）/`'right'`（C33）、`gap`（C33 は 1.0）、`lean` 0..1（肩に頭）、`look` 0..1（彼に顔を向ける）、`seat` `'grass'`/`'sofa'`、`sofa`（描く）、`blanket`（毛布、C35）、`boyLook`, `boyNod` | C22・C33・C42 は**同じ数値のカメラ**（例 `facing:-0.42, camPitch:0.2`）。芝生の彼は**片膝を立てて腕を乗せる**。C35 は彼女の側から（例 `facing:0.5, side:'right', gap:0, lean:1, blanket:true`） |
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
| | `spring2` | 2年目の春（C41）：ブラウス＋生成りのカーディガン、**紺のアームスリング（右前腕を袋で吊る）** |
| | `ending` | 終章（C42）：白いワンピース＋生成りのカーディガン、ネックレス、アームスリングなし |
| 彼 | `uniform` | 白シャツ（第一ボタンを外す）、緩めた**深緑**のネクタイ、袖まくり、ベルト、チャコールのズボン、**上履き（つま先が深緑）**、首に有線イヤホン |
| | `summer_uniform` | 袖まくり、ネクタイなし、首元を開ける（C13/C14） |
| | `blazer` | ＋紺ブレザー（前を開ける）、ローファー |
| | `tee` | 白T＋前を開けた水色の**半袖**シャツ（袖の折り返し）、チャコールのパンツ、白いスニーカー（C15/C19） |
| | `jacket` | 黒T＋焦げ茶の革ジャン、ジーンズ、**黒いブーツ**、首にイヤホン |
| | `wet` | 雨で張りつく白シャツ（**透けない**、引っ張りじわ）、濡れたズボン、髪は `wet` |
| | `ending` | 白い無地のシャツ（袖まくり）、チャコールのパンツ、スニーカー（C42） |
| 叔母 | `coat` | **チャコール**の薄手のロングコート（膝下、ベルトなし）＋黒のニット、黒タイツ、ショートブーツ、肩に小さなバッグ |

追加した素材（`PV.anime.COLORS` に**未定義の時だけ**足す。`anime.js` は変更していない）：
`shirt_blue, tee_black, jeans, belt, buckle, sole, sneaker, slipper, chain, wood, steel, lacquer, cushion, carton, carton_band, straw, sofa, strap, rosewood, maple, guard, chrome, rail, grass, tights, boot, pumps, sandal, bandage, pajama_pants, long_skirt, turtle, piping, sash, sling, ivory, ebony, uwabaki, toe_red, toe_green, coat_charcoal, blanket, bag_camel, bag_black, cable, brace_navy`。
DESIGN_PATCH（`anime.js` の DESIGN / COLORS）の素材 `necklace`（銀のチェーン）・`brace`（紺の装具）・`tie`（深緑）・`cardigan`（生成り）を使う。

## 5. ポーズ（`pose`）
| ポーズ | アンカー | 既定の向き | params | 用途 |
|---|---|---|---|---|
| `stand` | 両足の間の地面 | front | `weight` −1..1（コントラポスト：腰が上がり肩が逆に傾く、遊脚の膝が入る）、`armBend`（0.2）、`arms` `'relax'`/`'chest'`/`'behind'`/`'bow'`/`'cover'`/`'reach'`/`'pocket'`/`'strat'`/`'keys'`、`bow`, `nod`, `tilt`, `neckYaw`, `twist`, `stance` | 型紙、C13、C25 |
| `walk` | 骨盤の真下の地面 | front | `speed`（0.85 周期/秒）、`phase`, `stride`（0.55）、`neckYaw` / `twist`（肩越しに振り向く）、`arms:'bag'` | **C36**：`facing:-2.55, params:{neckYaw:1.2, twist:0.35}` |
| `piano` | ピアノ椅子の座面の中央 | 3q_right | `intensity` 0..1、`play`, `hands` `'keys'`/`'lap'`/`'lift'`、`look` `'keys'`/`'ahead'`/`'up'`、`breathe`, `lean`, `tilt`, `neckYaw`、`bench`、**`keys`（鍵盤、既定 true。シーンのピアノを使う時は false）**、`keysLeft/keysRight`（鍵盤の長さ、既定 2.65＝88鍵）、`desk`（譜面台）、`keyH`（1.0）, `keyZ`（1.12）, `benchH` | 顔＋手が見えるのは**高音側の端から**（`facing≈1.05, camPitch≈0.3`）、**右の横顔**（`'right'`）、**正面の上から**（`camPitch≈0.4`）。正面・斜め前の目の高さでは鍵盤蓋が手を隠す（実物どおり） |
| `seated_chair` | 学校の椅子の座面 | 3q_left | `variant` `'idle'`/`'juice'`（`sip`）/`'clap'`（`claps:[秒…]`、みぞおちの前で小さく）/`'guitar'`（音楽室のアコースティック、`strum`, `headDown`）、`chair`, `seatH`, `slump`, `nod`, `tilt`, `neckYaw` | C02/C04/C06/C12 |
| `kneel_guitar` | 膝の下の床 | 3q_left | `variant` `'raise'`/`'down'`、`look` | C14 |
| `run` | 骨盤の真下の地面 | 3q_left | `speed`（1.4）、`phase`, `stride`（ヒールなら 0.75）、`style`, `arms:'open'` | **C20：カメラに向かって** `facing≈-0.25` |
| `railing` | 両足の間の地面 | 3q_left | `variant` `'lean'`/`'hat'`/`'hold'`、`railing`（描く）, `railH`, `railZ`, `railMat`, `turn`, `tilt`, `neckYaw` | C15（`'right'` で帽子の下の横顔、`facing≈0.95` で帽子を押さえる斜め前）、C27（`turn:-0.5` で顔を向ける） |
| `sit_ground` | 腰の真下の地面（ソファの座面） | 3q_left | `knees` `'up'`/`'cross'`/`'out'`/`'one'`（片膝立て、`upSide`）、`arms` `'knees'`/`'prop'`/`'lap'`/`'hug'`/`'kneeRest'`、`lean`/`leanDir`, `look`, `sofa`, `seatH`, `blanket`, `armL/armR` | sit_side の部品 |
| `lie_back` / `kneel_up` | | | （C31/C30 の遠景用） | |
| `hug` | 両足の間の地面 | front | `partner`, `WL/WR`（手の位置を体の座標で直接指定）, `poleL/poleR`, `handL/handR`, `headSide`, `headYaw`, `tilt`, `side`, `lift`, `kick`, `leanBack` | embrace の部品 |

## 6. 小物（ポーズ・衣装が自動で描く）
ピアノ椅子、**鍵盤**（白鍵の面と目地、黒鍵、口棒、拍子木、鍵盤蓋、任意で譜面台。奥行きで手の下／前を切り替え）、学校の椅子、**紙パックのジュース**（色の胴＋白い帯とラベル＋ストロー）、アコースティック（傷なし）、白いストラト（塗装の剥げ）、ソファ、手すり、**毛布**（C35）、**ショルダーバッグ**（夏：キャメル斜め掛け、叔母：黒）、**有線イヤホン**（彼）、**ギプスと三角巾**、**紺のアームスリング**、上履き（学年色のつま先）、サンダルの革紐。

## 7. 性能（`dev_anime_body_perf*`：10体 − 0体、CPU は別作業と共有）
- 体のみ：**約 15 ms／人**（立ち、3/4、頭 120px）
- 本物の頭を含む全身：**約 23〜29 ms／人**（先輩 23〜29、彼 ≈24、ピアノ＋鍵盤 ≈21）。予算 30ms 以内。
- 決定論：同じフレームを2回描いて差分 0 バイト。2コマ打ち：同じ 1/12 秒の2フレームは画素一致。

## 8. ショット別の使い方（`analysis/anime_shot_plan.md` に対応）
```js
const A = PV.anime, tq = A.onTwos(T);
// C02/C04/C10 ピアノ：高音側の端から3/4（顔＋手）。シーンのグランドピアノを使う時は keys:false
A.figure(ctx, { who:'senpai', pose:'piano', facing:1.05, camPitch:0.3, x, y, scale, T, light:'window', rimDir:-0.5,
  params:{ intensity:0.9, keys:false }, head:{ expr:'focus', brows:{ furrow:0.6 } } });
// C17 右の横顔（ドレス）
A.figure(ctx, { who:'senpai', outfit:'dress', pose:'piano', facing:'right', camPitch:0.08, x, y, scale, T, light:'stage', params:{ intensity:0.6 }, head:{ expr:'focus' } });
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
A.pair(ctx, { pose:'sit_side', ...CAM, x, y, scale, T, light:'room_gray', params:{ side:'right', gap:1.0, seat:'sofa' }, senpai:{ outfit:'home', head:{ expr:'empty', talk:true } }, boy:{ outfit:'tee' } });
A.pair(ctx, { pose:'sit_side', ...CAM, x, y, scale, T, light:'sunset', rimDir:-0.3, params:{ side:'left', look:PV.smooth(167.7, 168.3, tq) }, senpai:{ outfit:'ending', head:{ expr:'gentle' } }, boy:{ outfit:'ending' } });
// C35 毛布にくるまって肩で眠る（彼女の側から）
A.pair(ctx, { pose:'sit_side', facing:0.5, camPitch:0.2, x, y, scale, T, light:'room_gray', params:{ side:'right', gap:0, seat:'sofa', lean:1, blanket:true }, senpai:{ outfit:'home', head:{ expr:'sleep' } }, boy:{ outfit:'tee', head:{ talk:true } } });
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
- 革ジャンの襟がやや大きく、ブレザー（彼）は前を開けた時にラペルではなく折り襟になる。叔母のコートの襟は簡素。
- ペアの接触（肩に頭、背中の手）は目で合わせた値。体格や向きを大きく変えると手が浮く／めり込むことがある。
- 帽子は頭ライブラリの描画（横からは、つばが円盤に見える）。
- 長い髪（後ろ姿・横顔の「黒いマント」）は頭ライブラリの課題（講評 §E に報告）。
