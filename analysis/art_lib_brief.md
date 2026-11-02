# 作画アセット共通ブリーフ（エージェント向け）

## 読むべきもの
- /home/user/animated-PJ/analysis/art_style_guide.md（美術・作画スタイルガイド）← 必読
- /home/user/animated-PJ/analysis/director_notes.md（原作の要点・モチーフ。人物や小物の意味を知るため）
- /home/user/animated-PJ/pv/engine/core.js（エンジンAPI：PV.rng, PV.noise2, PV.cached, PV.buffer, PV.ease, PV.smooth, PV.linGrad, PV.radGrad, PV.rgba, PV.mix など）
- /home/user/animated-PJ/pv/engine/lib/atmos.js（既存ライブラリの書き方の手本。PV.lib 名前空間）

## 作業ルール
- あなたの担当ファイル以外は編集しないこと（他のエージェントが並行して別ファイルを書いている）。
- 担当ライブラリは /home/user/animated-PJ/pv/engine/lib/<名前>.js に書く。IIFE で囲み、PV.lib.xxx = function(ctx, opts){...} の形で公開する。
- 見本シーン（ショーケース）を /home/user/animated-PJ/pv/scenes/_dev_<名前>.js に書く。PV.shot('dev_<名前>_1', {draw(ctx,t,d,S){...}}) のように、全アセットを見やすく並べた／画面いっぱいに使ったショーケースを複数作る。背景は単色やグラデーションでよいが、実際のPVの場面（逆光、窓の光、夜、雨など）に近い状況でも1つは試すこと。
- ファイルを追加したら必ず `cd /home/user/animated-PJ && node tools/build_index.cjs` を実行して index.html を再生成する。
- 静止画の確認: `cd /home/user/animated-PJ && node render/still.cjs --dev dev_<名前>_1 --dur 6 --times 0,2,4 --out /home/user/animated-PJ/analysis/art_review/<名前> --sheet`
  出力されたJPEGを Read ツールで必ず目で見て確認する（あなたは画像を見ることができる）。PAGE ERRORS が出たら修正する。
- 「描いて→レンダリングして→見て→直す」を最低4回は繰り返し、プロのアニメーターが見ても破綻のない、美しい絵になるまで磨くこと。妥協しない。
- 決定論的に描く（Math.random禁止）。重い静的描画は PV.cached でキャッシュ。1関数の描画は目安40ms以内（still.cjs が描画msを表示する）。
- 最後に、作った関数ごとの「API説明（引数・座標系・推奨サイズ・見た目）」を Markdown で /home/user/animated-PJ/analysis/art_review/<名前>_API.md に書く。
