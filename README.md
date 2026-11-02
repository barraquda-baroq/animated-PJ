# 『キミの右手のアイロニー』 劇場アニメーション 本予告（3分）

原作：宮本有楽『キミの右手のアイロニー』（全40話）
個人利用のための制作物です（Web公開しない前提）。

## 成果物

| ファイル | 内容 |
|---|---|
| `deliverables/kimi_no_migite_PV.mp4` | 完成版 本予告（1920×1080 / 24fps / 180秒 / H.264 3.4Mbps + AAC 256kbps / -15 LUFS） |
| `deliverables/stills/` | 代表カットの静止画 |
| `analysis/pv_storyboard.md` | 絵コンテ（44カット・台詞・音楽・効果音の秒単位設計） |
| `analysis/director_notes.md` | 監督の通読メモ（全40話の要点と名台詞） |
| `analysis/story_bible.md` | ストーリーバイブル（人物・相関・感情曲線・モチーフ・台詞候補） |

## コンセプト

3分間を一曲の「セッション」として編む。先輩の右手＝ピアノ（画面と音の左）、彼の左手＝ギター（右）。
主題〈Session〉の頭の二音 A4→F#5 を先輩の口癖「ねえ」の動機にし、涙で生まれ、約束の夜に言葉と重なり、
事故の朝にブレーキ音が二音目を奪い（2秒の完全な無音）、心電図が同じ F#5 で鳴り続け、終章でようやく二音目が鳴ってタイトルになる。

メインコピー：**動かなくなった右手が、ふたりを結んだ。**

## 作り方（再現手順）

すべてコードで描画・作曲・合成しています（生成AI画像は不使用）。

```bash
tools/fetch_fonts.sh                      # OFLフォント（しっぽり明朝・Zen Old Mincho・Cormorant）を取得
tools/start_voicevox.sh                   # VOICEVOX ENGINE を 127.0.0.1:50021 で起動
python3 audio/voice_takes.py              # 台詞18本をフレーズ単位で合成 → audio/voice_out/
python3 tools/make_timeline.py            # 絵コンテ → pv/timeline.js（テロップ・字幕込み）
python3 tools/make_voice_env.py           # 台詞の口パク用エンベロープ → pv/engine/lib/anime_voice.js
python3 audio/compose_pv.py               # 劇伴（21キュー）→ audio/out/score.wav
python3 audio/make_sfx_plan.py            # 効果音プラン
python3 audio/mix.py                      # 最終ミックス → audio/out/master.wav（-15 LUFS前後）
node render/video.cjs --out frames        # 映像フレーム書き出し（ヘッドレスChromium）
render/encode.sh frames audio/out/master.wav deliverables/kimi_no_migite_PV.mp4 3.4
```

- `pv/engine/` … 決定論的なフレームレンダラ（Canvas2D＋DOMの縦書きテロップ、ブルーム/ハレーション/グレイン）
- `pv/engine/lib/` … 作画ライブラリ（背景美術・手のリグ・人物シルエット・楽器・小物・FX）
- `pv/scenes/` … 44カットの演出・作画
- `audio/` … 作曲ツール（MIDI→FluidSynth/MuseScore General）、効果音合成、台詞合成、ミックス

## 台詞の音声について

台詞は **VOICEVOX ENGINE 0.26.0**（公式 Docker イメージ `voicevox/voicevox_engine:cpu-latest` から取り出したエンジン）で合成しています。
キャスト：先輩＝冥鳴ひまり、彼＝玄野武宏（ノーマル／悲しみ）、叔母＝九州そら。
`audio/voice_takes.py` が台本の演技指示に合わせて台詞を「間」の位置でフレーズに分けて合成し、間の長さ・スタイル（悲しみ等）・抑揚・
震え（モーラ単位のピッチの揺れ）・息まじり（LPCで作るささやき成分）をフレーズごとに指定してつないでいます。尺はすべて絵コンテの上限内です。

## クレジット・ライセンス

- 原作：宮本有楽『キミの右手のアイロニー』
- 音声合成：VOICEVOX:冥鳴ひまり、VOICEVOX:玄野武宏、VOICEVOX:九州そら（各キャラクターの利用規約に従いクレジットを表記。映像の最後にも表示）
- 音源：MuseScore General soundfont（MIT）、FluidSynth（LGPL）
- 引用曲：J.S.バッハ〈G線上のアリア〉冒頭（パブリックドメイン。旋律は Mutopia Project の楽譜データより）
- 引用曲：F.ショパン〈練習曲 作品10-3（別れの曲）〉冒頭（パブリックドメイン。依頼主から提供された楽譜PDFより採譜：`audio/themes.py` の `OP10_3`）
- フォント：しっぽり明朝、Zen Old Mincho、Cormorant Garamond（SIL Open Font License）
- その他の劇伴（主題〈Session〉ほか）・効果音・映像はすべて本プロジェクトのオリジナル
