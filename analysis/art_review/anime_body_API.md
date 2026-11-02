# anime_body.js — アニメ調の体・衣装・ポーズ API（作画監督：体）

`pv/engine/lib/anime_body.js`（名前空間 `PV.anime`）。ショーケース：`pv/scenes/_dev_anime_body.js`。
- `dev_anime_body_1` / `_2`：先輩・彼の制服の型紙（正面・3/4・横・後ろ）
- `_3` / `_4`：全衣装の一覧（3/4）、`_11`〜`_14`：**全13衣装の正面・横・後ろ**
- `_5` ピアノ（窓の逆光・白い舞台）、`_6` 椅子（ジュース・拍手・ギター）、`_7` 舞台（ストラト・膝立ち2種・振り返る叔母）、`_8` 手すり（夏・嵐）と走り、`_9` 並んで座る（C42 夕日・C22 夜・C33 灰色の部屋）、`_10` 抱擁（雨）・飛び込み・倒れ込み
- 計測用 `dev_anime_body_perf*`、API 確認 `dev_anime_body_api`（flip / alpha / 決定論）、`dev_anime_body_dbg`
最新の確認画像：`analysis/art_review/anime_body/`（`dev_anime_body_N.jpg`、一覧 `overview.jpg`、6秒の動きの確認 `anim_5|8|9|10/sheet.jpg` = 0/2/4 秒）。
顔・髪は `anime_head.js`（`PV.anime.head / headBack`、別担当）を **HEAD API の通りに** 呼ぶ。未ロード／例外時だけ簡易な代用の頭を描く。

## 1. 仕組み（ポリゴンに見えないための作り）
- **3D なのは骨格だけ**：関節位置（IK）、楕円リングを積んだ胴（ロフト）、リングから垂らすスカート。見える物はすべて、投影した骨格から作る**なめらかな2D図形**（Catmull-Rom の輪郭）で、面ごとの陰影や全身の3Dグラデーションは一切ない。正面・3/4・横・後ろ・その間の角度が1つのポーズから同じ形で出る。
- **主線**：同じ奥行きの層（脚、体、奥の腕…）の部品は**1本の外形線**を共有する（塗りの後ろに描くストローク）。光と反対側を太く（約1.3×inkW）、光側を細く（約0.62×inkW）。同じ層で別の部品に重なる所だけ細い内側の線（0.85×inkW）を引き、袖と肩・前腕と上腕のように**形がつながる所には線を引かない**（入り抜きで消える）。線色は素材ごと（肌＝暖かい茶、白い布＝青灰、紺＝濃紺）。線幅は `PV.anime.inkW(画面上の頭の高さ)`。
- **腕・脚は1本の輪郭**（`limb2`）：肘・膝の内側は2本の輪郭の交点で折り、外側は関節を回る円弧。関節に丸い「玉」が出ず、影の帯とリムが関節を通って途切れない。
- **セル塗り**：ベタ＋光と反対側の1影の帯（くっきり）＋設計した影（襟・リボンの落ち影、スカートの裾が太ももに落とす影、顎が首に落とす影、腕が胴に落とす影、プリーツの交互の影、バストの下）＋艶のある素材の光側のハイライト帯（ローファー、ヒール、革ジャン、ストラト、ベルト）＋逆光条件（`LIGHT[*].rimA`）では `rimDir` 側に鋭いリムの帯。夜・嵐ではリム幅を少し太くして形を読ませる。
- 布と体の揺れは**2コマ打ち**（`PV.anime.onTwos(T)`）。決定論的（`Math.random`/`Date` 不使用。同じフレームを2回描いて画素差 0 を確認）。
- **肌の明るさは顔と同じ**：肌系の素材は頭ライブラリの `PV.anime.faceAmb(light)`（暗い照明で少し持ち上げる「顔の光」）と同じ amb を使うので、首・手・脚が顔より暗くならない。服は暗い照明で amb を 22% だけ持ち上げる（夜・嵐でも色が残る）。`o.amb` を渡すと全素材がその値になる。

## 2. `PV.anime.figure(ctx, o)` — 1人
| 引数 | 既定 | 説明 |
|---|---|---|
| `who` | `'senpai'` | `'senpai'`（7.0頭身）／`'boy'`（7.3頭身、肩幅≒1.8頭）／`'aunt'`（7.2頭身） |
| `outfit` | 人物ごと | §4 の衣装名 |
| `pose` | `'stand'` | §5 のポーズ名 |
| `x, y` | 0, 0 | **アンカー**（ポーズごとに §5：立ち＝両足の間の地面、座り＝座面、膝立ち＝膝の下の床…）。ctx の座標（カメラ変換の中でそのまま使える） |
| `scale` | 100 | **頭1つ分の px**（あご〜頭頂）。`PV.anime.bodyScale(who, 身長px)` で身長から逆算 |
| `facing` | ポーズごと | `'front'`, `'3q_right'`, `'right'`, `'3q_back_right'`, `'back'`, `'3q_back_left'`, `'left'`, `'3q_left'`、または数値（rad。+π/2＝画面右向きの横顔） |
| `camPitch` | 0 | 見下ろし(+)/見上げ(−)のカメラの傾き（rad、正射影） |
| `T` | 0 | 全体の秒（瞬き・口パク・呼吸・揺れ。2コマ打ち） |
| `light` | `'day'` | `PV.anime.LIGHT` の名前（day / window / classroom / sunset / dusk / night / storm / lightning / stage / spot / room_gray / lamp / hospital / summer / golden） |
| `keyDir` | `rimDir` か −2.3 | 主光の方向（rad、人物→光、画面座標）。1影の帯はその反対側 |
| `rimDir` | `keyDir` | 逆光のリムの方向（rad、人物→光） |
| `rimA`, `rimColor`, `amb` | 照明どおり | リムの強さ／色、影絵への沈み具合（`PV.anime.mat` の `amb`）の上書き |
| `wet` | 0 | 0..1 濡れ（色が沈み艶が出る）。`outfit:'wet'` は自動で 1 |
| `wind`, `windDir` | 0, 0 | 風（0..2）と風下の方向（rad、画面座標）。スカート・裾・髪に効く。`pose:'run'` では未指定なら走る向きと逆に自動で風 |
| `head` | {} | `PV.anime.head` にそのまま渡す：`expr, eyes, mouth, talk, brows, blush, hair{style,wind,windDir}, pitch, roll` など。加えて `turn`（体の向きからの首の追加回転、HEAD API の yaw 単位）、`yaw`/`back`（絶対値で上書き）、`sizeK`（頭の大きさの倍率） |
| `params` | {} | ポーズ固有の値（§5） |
| `costume` | — | 衣装フラグの部分上書き（例 `{ ribbon:false }`） |
| `alpha` | 1 | 1 未満はオフスクリーンで合成（重なりが二重にならない） |
| `flip` | false | 左右反転（体だけ鏡映、頭は向きを反転して正しく描く）。非対称の衣装（ギプスは右腕）は反転しないこと → 向きは `facing` で変える |
| `line` | 1 | 線幅の倍率（頭にも渡す） |
| `noHat` | false | 夏服の帽子を描かない |

戻り値：`{head (PV.anime.head の戻り値：chin, eyeL/R, crown…), neck, hands:{L,R}（手首）, shoulders:{L,R}, pelvis}`（ctx 座標）。小物やエフェクトの位置合わせに使う。

**描画順**（1人の中）：`headBack` → 小物（奥）→ 奥の腕 → 奥の脚 → 手前の脚 → 小物（中）→ 体（首・胴・スカート・上着・手前の腕）→ `head({...,layer:'front'})` → 顔の前に来る手（ジュースを飲む手、顔を覆う手）。

## 3. `PV.anime.pair(ctx, o)` — 2人
2人を共通の「ペア空間」（先輩の頭単位、`facing:'front'` で +x＝画面右、+z＝カメラ側）に置き、`facing` でペアごと回す。彼は先輩の頭の **1.04 倍**で描く（7.3頭身×大きめの頭＝身長差 約8%）。

| 引数 | 説明 |
|---|---|
| `pose` | `'sit_side'` / `'embrace'` / `'leap_embrace'` / `'collapsed'` |
| `x, y` | 2人の間の地面（座りは座面）。`scale` は**先輩の**頭の px |
| `facing`, `camPitch`, `T`, `light`, `rimDir`, `keyDir`, `wind`, `windDir`, `alpha` | figure と同じ（2人に共通） |
| `params` | ペアのポーズの値（下表） |
| `senpai`, `boy` | 人物ごとの上書き：`outfit`, `head{expr, eyes, mouth, talk…}`, `params`, `wet`, `scaleK` |

戻り値：`{ senpai: info, boy: info }`（figure の戻り値と同じ形）。

| ペア | 既定の向き | params | 用途 |
|---|---|---|---|
| `sit_side`（別名 `sit_back`＝既定のカメラが後ろ） | `'3q_left'`（C22/C33/C42 は 3 ショットとも同じ数値、例 `-0.38` を推奨：浅い角度だと脚が相手に重ならず、C33 の隙間が読める） | `side` `'left'`(先輩が彼の左＝C22/C42) / `'right'`(C33)、`gap`（隙間、C33 は 0.7 前後）、`lean` 0..1（先輩の頭が彼の肩へ）、`look` 0..1（先輩が彼に顔を向ける）、`seat` `'grass'`/`'sofa'`、`sofa`（ソファを描く、既定 true）、`boyLook`, `boyNod` | C22・C33・C42（同じ斜め前のカメラで並びの変化を見せる）、C35 |
| `embrace` | `'front'`（彼の顔がカメラ側） | `progress` 0..1（0＝飛び込んだ瞬間：先輩は宙、彼はのけぞる）、`headSide` −1/+1 | C32（彼女の肩越しの彼の顔、彼の肩に顎をのせた彼女の横顔） |
| `leap_embrace` | `'right'` | `progress`（既定 0.3） | C20 の飛び込み |
| `collapsed` | `'right'` | `rise` 0..1（0＝彼に覆いかぶさる、1＝膝立ちで天を仰ぐ）、`sob`, `headUp`, `boyArms` | C31 |

## 4. 衣装（`outfit`）
| 人物 | 名前 | 内容 |
|---|---|---|
| 先輩 | `uniform` | 白ブラウス（尖った襟、前立てとボタン、カフスとボタン、肘のしわ、ウエストのたるみのしわ、バスト下の影）、赤いリボン（輪・結び目・V字に切った垂れ）、紺のプリーツスカート（折り目の線と交互の影、ウエストバンド、ジグザグの裾）、紺のハイソックス（口ゴムの線）、茶のローファー（ストラップ・艶） |
| | `blazer` | 上＋紺ブレザー（襟とラペル、V の開きからブラウスとリボン、ボタン2、ポケットのフラップ、裾の割れ、袖口からブラウスのカフス） |
| | `dress` | 濃紺のドレス（スクープネック＝鎖骨が見える、キャップスリーブ、ウエストの切り替え、膝丈のフレア）、細いチェーンのネックレス（ペンダント）、低いヒール。髪は自動で `style:'updo'` |
| | `dress_cardigan` | ドレス＋淡いグレーのカーディガン（前開き、ボタンと前立ての線、リブの裾と袖口）。髪は `style:'loose'` |
| | `summer` | 白いワンピース（スクエアネック、フレアの袖、ふくらんだ長めの裾、腰のサッシュと蝶結び）、白いサンダル、つば広の帽子（**頭のライブラリが描く**：`head.hat=true` を自動で渡す） |
| | `gown` | 病院のパジャマ（開いた襟と V の素肌、前立て）、パジャマのズボン、スリッパ、**右前腕の白いギプス（指先が出る）と吊り帯（腕を受ける三角の布＋首へ回る2本の帯）**。右腕は自動で吊った姿勢（`params.castFree:true` で解除） |
| | `home` | ゆったりした灰色のニット（クルーネックのリブ、袖が手の甲まで、リブの裾）＋長い暗色のスカート、スリッパ |
| 彼 | `uniform` | 白シャツ（開いた襟と首の V、前立て、まくった袖の折り返し、ウエストのたるみ）、緩めた紺のネクタイ（結び目が下がる、胸の面に沿って揺れる）、ベルトとバックル、チャコールのズボン（前の折り目、膝のしわ、裾のたるみ、ポケットと前立ての線）、焦げ茶のローファー |
| | `blazer` | 上＋紺ブレザー（ラペル、ボタン2、ポケット） |
| | `tee` | 白T（クルーネック）＋前を開けた水色のシャツ（襟、袖まくり）、ズボン、スニーカー |
| | `jacket` | 黒T＋焦げ茶の革ジャン（大きめの襟、ジップの線、艶、ポケット）、ジーンズ、スニーカー |
| | `wet` | 雨で張りつく白シャツ（ゆとりなし、肌が透ける淡い面、引っ張られたしわ）、濡れたズボン。髪は `style:'wet'` |
| 叔母 | `coat` | 暗色のタートルネック＋膝下までの暗色のコート（ラペル、ボタン3、前の合わせの線、ポケット）、黒タイツ、ショートブーツ |

追加した素材（`PV.anime.COLORS` に**未定義の時だけ**足す。`anime.js` 本体は変更していない）：
`shirt_blue, tee_black, jeans, belt, buckle, sole, sneaker, slipper, chain, wood, steel, lacquer, cushion, carton, carton_band, straw, sofa, strap, rosewood, maple, guard, chrome, rail, grass, tights, boot, pumps, sandal, bandage, pajama_pants, long_skirt, turtle, piping, sash, sling`。

## 5. ポーズ（`pose`、すべて顔が見える向きで使える）
| ポーズ | アンカー | 既定の向き | params | 主な用途 |
|---|---|---|---|---|
| `stand` | 両足の間の地面 | front | `weight` −1..1（コントラポスト：+ で左脚に重心。腰が上がり肩が逆に傾く）、`arms` `'relax'`/`'chest'`（右手を胸に）/`'behind'`/`'bow'`/`'cover'`（左手で顔を覆う、頭より手前に描く）/`'reach'`/`'pocket'`/`'strat'`（ストラトを肩掛けで弾く）/`'keys'`（立ってキーボードを弾く）、`bow` 0..1、`nod`, `tilt`, `neckYaw`（振り返り）、`twist`, `stance` | 型紙、C13、C25、C36（`facing:'3q_back_left', params:{neckYaw:1.15}` で肩越しに振り返る）、C39 |
| `piano`（別名 `piano_back`＝既定 `3q_back_right`） | ピアノ椅子の座面の中央（鍵盤は前方 1.12、座面から 1.0 上） | 3q_right | `intensity` 0..1（揺れ・前のめり・手の移動、〈雪あらし〉＝0.9）、`play` 0..1、`hands` `'keys'`/`'lap'`/`'lift'`、`look` `'keys'`/`'ahead'`/`'up'`、`breathe` 0..1（弾き終えて肩で息）、`lean`, `tilt`, `neckYaw`, `bench`（椅子を描く、既定 true）、`keyH`, `keyZ`, `benchH` | C02（横〜斜め前）、C04、C10（`head:{expr:'closed'}`）、C16/C17（dress）、C08 |
| `seated_chair` | 学校の椅子の座面の中央 | 3q_left | `variant` `'idle'`/`'juice'`（`sip` 0..1：ストローを口に／膝に下ろす）/`'clap'`（`claps:[全体の秒…]` で拍手の瞬間に手が合う、または `clap` 0..1）/`'guitar'`（アコギを右の太ももに、`strum`、`headDown`）、`chair`（既定 true）、`seatH`, `slump`, `nod`, `tilt`, `neckYaw` | C02/C04 の奥の彼（ジュース・拍手）、C06（バストは頭ライブラリ）、C08/C12（ギター） |
| `kneel_guitar` | 膝の下の床 | 3q_left | `variant` `'raise'`（ストラトを掲げ天を仰ぐ）/`'down'`（うなだれる、ギターは腿にもたれる）、`look` | C14 |
| `run` | 骨盤の真下の地面（支える足が接地するよう骨盤の高さを毎コマ計算） | 3q_left | `speed`（周期/秒、1.4）、`phase`, `stride`（ヒールなら 0.75）、`style` `'girl'`/`'boy'`、`arms:'open'`（飛び込む直前に腕を開く） | C20（正面寄りの 3/4 で駆けてくる） |
| `railing` | 両足の間の地面（手すりは前方 `railZ`=0.78、高さ `railH`=4.45） | 3q_left | `variant` `'lean'`（前腕を手すりに、C15）/`'hat'`（片手で帽子を押さえる）/`'hold'`（手すりを握る、C27）、`railing`（手すりを描く、既定 false）、`railMat` `'rail'`/`'steel'`、`turn`（カメラへひねる）、`tilt`, `neckYaw` | C15、C27/C28 |
| `sit_ground` | 腰の真下の地面（またはソファの座面） | 3q_left | `knees` `'up'`/`'cross'`/`'out'`、`arms` `'knees'`（膝を抱える）/`'prop'`（後ろに手をつく）/`'lap'`/`'hug'`、`lean` 0..1 と `leanDir`（±1）、`look`, `sofa`, `seatH`, `armL/armR`（腕の上書き） | sit_side の部品、C35 |
| `lie_back` | 骨盤の下の地面（頭は −z） | left | `headUp`, `arms` `'side'`/`'reach'`/`'chest'`, `look` | collapsed の彼、C30 の視点の主 |
| `kneel_up` | 膝の下の地面 | right | `rise` 0..1（四つ這い→膝立ち）、`reach`（四つ這いの手の前方距離）、`fist`（左の拳を振り上げる＝C30 の胸を打つ前）、`sob`, `look` | collapsed の先輩、C30（`camPitch` を負にして見上げる） |
| `hug` | 両足の間の地面 | front | `partner` `'over'`/`'under'`、`reachZ`, `handY`, `headSide`, `headYaw`, `tilt`, `side`, `lift`, `kick`, `leanBack`, `dip` | embrace / leap_embrace の部品 |

## 6. 小物（ポーズが自動で描く／`params` で消せる）
ピアノ椅子（黒い漆の枠＋座面のクッション＋脚）、学校の椅子（木の座面と背、スチールの脚）、紙パックのジュースとストロー（握った手に、手が顔の前なら頭より手前）、アコースティックギター（胴・ロゼッタ・サウンドホール・ブリッジ・ピックガード・傷・ネックとフレット・弦・ヘッド）、白いストラト（白いボディ、ピックガード、ピックアップ3、ブリッジ、ノブ、**塗装の剥げ**、メイプルのネック、ストラップ）、ソファ、手すり。
ギターは「平らな物の正射影はアフィン変換」なので、2Dで描いた絵を投影した軸で置く（3/4でも正しく傾き、横から見ると厚み＝側板が見える）。

## 7. 性能（`dev_anime_body_perf*` で 10 体描画し、何も描かない `perf0` のポストエフェクト分を差し引き。CPU は別作業と共有）
- 体のみ：**約 14〜22 ms／人**（立ち、3/4、頭 120px）
- 本物の頭を含む全身：**約 23〜31 ms／人**（先輩 23〜26、彼 24〜31。頭ライブラリ ≒ 8〜12 ms）
- 最初の1フレームは JIT のため遅い（全体 +200〜400ms）。ペア：約 50〜60 ms。

## 8. ショット別の使い方（`analysis/anime_shot_plan.md` に対応）
```js
const A = PV.anime;
// C02/C04 ピアノの先輩（窓の逆光、斜め前から）と奥の彼
A.figure(ctx, { who:'senpai', outfit:'uniform', pose:'piano', facing:'3q_right', x, y, scale:150, T, light:'window', rimDir:-0.5,
  params:{ intensity:0.9 }, head:{ expr:'focus' } });
A.figure(ctx, { who:'boy', outfit:'uniform', pose:'seated_chair', facing:'3q_left', x:x2, y:y2, scale:60, T, light:'window', rimDir:-0.4,
  params:{ variant:'clap', claps:[10.6, 11.1, 11.6] } });           // C04：拍手の秒（全体の秒）
// C10 目を閉じて弾く（横顔〜3/4）
A.figure(ctx, { who:'senpai', pose:'piano', facing:'right', x, y, scale:170, T, light:'window', params:{ intensity:0.35, look:'ahead' }, head:{ expr:'closed' } });
// C12 ギターを膝に俯いて泣く彼（台詞の口パク）
A.figure(ctx, { who:'boy', pose:'seated_chair', facing:'3q_left', x, y, scale:140, T, light:'window', params:{ variant:'guitar', headDown:0.15 }, head:{ expr:'cry', talk:true } });
// C13 立ってストラト／C14 掲げて天を仰ぐ
A.figure(ctx, { who:'boy', pose:'stand', facing:'3q_left', x, y, scale, T, light:'spot', rimDir:-1.6, params:{ arms:'strat' } });
A.figure(ctx, { who:'boy', pose:'kneel_guitar', facing:'3q_left', x, y, scale, T, light:'spot', rimDir:-1.6, params:{ variant:'raise' } });
// C15 手すりにもたれる先輩（帽子と風）
A.figure(ctx, { who:'senpai', outfit:'summer', pose:'railing', facing:'3q_left', x, y, scale, T, light:'summer', wind:1, windDir:3.0, params:{ variant:'lean' }, head:{ expr:'smile' } });
// C20 駆けてくる → 飛び込む
A.figure(ctx, { who:'senpai', outfit:'dress_cardigan', pose:'run', facing:'3q_left', x, y, scale, T, light:'night', rimDir:-2.6, params:{ stride:0.75 }, head:{ expr:'smile' } });
A.pair(ctx, { pose:'leap_embrace', x, y, scale, T, light:'night', facing:'3q_right', params:{ progress:p }, senpai:{ outfit:'dress_cardigan' }, boy:{ outfit:'jacket' } });
// C22（先輩は彼の左、頭を肩へ）／C33（右に一人分の隙間、ソファ）／C42（彼に顔を向ける）— 3ショットとも同じ facing
A.pair(ctx, { pose:'sit_side', facing:-0.38, x, y, scale, T, light:'night', params:{ side:'left', lean:PV.smooth(73.6, 74.4, T) }, senpai:{ outfit:'dress_cardigan', head:{ expr:'closed' } }, boy:{ outfit:'jacket' } });
A.pair(ctx, { pose:'sit_side', facing:-0.38, x, y, scale, T, light:'room_gray', params:{ side:'right', gap:1.0, seat:'sofa' }, senpai:{ outfit:'home', head:{ expr:'empty', talk:true } }, boy:{ outfit:'tee' } });
A.pair(ctx, { pose:'sit_side', facing:-0.38, x, y, scale, T, light:'sunset', rimDir:-0.3, params:{ side:'left', look:PV.smooth(167.7, 168.3, T) }, senpai:{ head:{ expr:'smile' } } });
// C25 窓際に立つ彼（苦しげ）／C36 振り返る叔母
A.figure(ctx, { who:'boy', pose:'stand', facing:'front', x, y, scale, T, light:'window', params:{ weight:0.2, nod:0.15 }, head:{ expr:'pain', talk:true } });
A.figure(ctx, { who:'aunt', pose:'stand', facing:'3q_back_left', x, y, scale, T, light:'window', rimDir:0.2, params:{ neckYaw:1.15 }, head:{ talk:true } });
// C27 嵐の欄干（パジャマ・ギプス・濡れ髪）／C31 覆いかぶさる→起き上がる／C32 抱擁
A.figure(ctx, { who:'senpai', outfit:'gown', pose:'railing', facing:'3q_right', x, y, scale, T, light:'storm', wet:1, params:{ variant:'hold' }, head:{ expr:'cry', hair:{ style:'wet' } } });
A.pair(ctx, { pose:'collapsed', facing:'right', x, y, scale, T, light:'storm', params:{ rise:PV.smooth(115, 116, T) }, senpai:{ outfit:'gown', wet:1, head:{ expr:'cry' } }, boy:{ outfit:'wet', head:{ talk:true } } });
A.pair(ctx, { pose:'embrace', facing:'front', x, y, scale, T, light:'storm', senpai:{ outfit:'gown', wet:1, head:{ expr:'surprise' } }, boy:{ outfit:'wet', head:{ expr:'determined', talk:true } } });
```

## 9. 既知の弱点（正直に）
- **嵐・夜の照明では体がかなり暗い**：`LIGHT.storm`（amb 0.55, dark 0.52）は白いシャツも暗い灰青に沈める。リムで形は読めるが、明るく見せたい場合はシーン側で `amb`（例 0.35）か `rimA` を上げる。頭も同じ `mat` を使うので、体だけ明るくしないこと。
- **手**は「簡略化した手」（甲・横・小指側・手のひら・拳の5形、指は先だけ分かれる）。頭の高さ 150px 以上の寄りでは物足りない。手元のアップは `hands.js` を使う。
- **腕はまだ素直な管に近い**（袖のしわは肘の内側と袖口の数本だけ）。肘を大きく曲げた袖（ジュース、拍手）は良いが、まっすぐ下ろした腕は単調。
- **座ったスカート**は前（膝へ）・横（腿の横に垂れる）・後ろ（座面）の3帯で近似。膝を立てた座り（地面）では脚の間の布が三角に見えることがある。
- **ペアの接触は目で合わせた値**（頭を肩に乗せる、背中に回した手）。体格や向きを大きく変えると手が背中から浮く／めり込むことがある。`embrace` の横向き（`facing:'right'`）は先輩の髪が彼の顔を隠すので、C32 は `front`（彼の顔側）を推奨。
- 走り（`run`）は 3/4 からの小走り。真横からの全力疾走や、ヒールでのよろめきのような芝居はない。
- `collapsed` と `kneel_up` は暗いストロボ用の精度（四つ這いの手の位置、濡れ髪のかかり方は頭ライブラリ次第）。
- 小物（椅子・ソファ・ピアノ椅子）は箱を組んだ形でセル塗りしている。家具として違和感はないが、背景美術ほどの描き込みはない。
- 帽子は頭ライブラリの描画（真横・目の高さでは、つばが線になる）。
- 叔母のコートの正面は、暗色のラペル・タートルネック・コートが同系色で「よだれかけ」のように固まって見える。逆光の戸口（C36）では問題にならないが、明るい場所の正面では弱い。
- 頭ライブラリが無い／例外を出した時の代用の頭は、確認用の簡易な絵（本番では使わない）。
