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
python3 tools/make_timeline.py            # 絵コンテ → pv/timeline.js（テロップ・字幕込み）
python3 audio/voice.py                    # （台詞の合成は audio/voice.py の render_all を使用）
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

現在の版の台詞は **Open JTalk（HTS音声）** で合成しています。
公式の VOICEVOX ENGINE（Docker Hub `voicevox/voicevox_engine:cpu-latest`）を取得済みですが、外部から取得したプログラムの実行には利用者の許可が必要なため、許可が得られた時点で差し替えます。
差し替え時のキャスト案：先輩＝冥鳴ひまり、彼＝玄野武宏（ノーマル／悲しみ）、叔母＝九州そら。
（`tools/start_voicevox.sh` で起動 → `audio/voice.py` が自動で VOICEVOX を使用 → `make_timeline.py` → `mix.py` → 再エンコード）

## クレジット・ライセンス

- 原作：宮本有楽『キミの右手のアイロニー』
- 音声合成：Open JTalk / HTS voice "Mei"（© Nagoya Institute of Technology, CC BY 3.0）, nitech_jp_atr503_m001（Modified BSD）
- 音源：MuseScore General soundfont（MIT）、FluidSynth（LGPL）
- 引用曲：J.S.バッハ〈G線上のアリア〉冒頭（パブリックドメイン。旋律は Mutopia Project の楽譜データより）
- フォント：しっぽり明朝、Zen Old Mincho、Cormorant Garamond（SIL Open Font License）
- その他の劇伴（主題〈Session〉ほか）・効果音・映像はすべて本プロジェクトのオリジナル
