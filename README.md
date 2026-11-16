# TYPO CAM

空間に言葉を置いて、思い出を残すARタイポカメラ。

スマートフォンのブラウザで開くとすぐARカメラが起動し、好きな言葉・フォント・色を選んで現実空間に立体文字を置き、写真や動画として保存できます。
[Font Photo AR](https://github.com/NaohiroEnya/Font-Photo-AR) の8th Wall構成(6DoF SLAM + three.js)をそのままベースにしており、iOS Safari(WebXR未対応)でもネイティブアプリなしで空間固定ができます。

## 機能

- **文字入力** — 右ツールバー「文字」から短い言葉(20文字まで)を入力し、空間をタップするとその位置に3D文字を配置
- **配置後の調整** — 文字をドラッグで移動、ピンチで拡大・縮小、2本指でひねって回転。空間の何もない所をタップで選択解除、ゴミ箱で削除
- **スタイル** — 旅ログ / 休日 / エモい / クール の4プリセット。フォント・カラー・立体感(厚み・質感・発光)がまとめて切り替わる
- **フォント** — 明朝 / 太ゴシック / ゴシック / 丸ゴシック / 手書き / コンデンス の6種類。入力中の言葉そのものでプレビューしながら選択
- **カラー** — 8色のパレット
- 文字を選択中にスタイル・フォント・カラー・文字を変えると、その文字がその場で更新される
- **写真** — カメラ映像+AR文字だけを撮影(ツールUI・ガイド・選択リングは含まない)。撮影後のプレビューから保存
- **動画** — 写真/動画を切り替えてシャッターで録画開始・停止(最大60秒)。録画中はシャッター以外のUIを非表示
- **レシピ共有** — 左上「レシピ」から、今の文字設定(テキスト・フォント・カラー・スタイル・サイズ)をURLで共有。開いた人は同じ設定で自分の場所に置いて撮影できる

## 使い方

1. `npm install`
2. `npm run serve`
3. スマホ実機で確認する場合は[こちらの手順](https://8th.io/test-on-mobile)に従ってHTTPS経由で接続してください

## 構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 8th Wall エンジン/XRExtras/LandingPage の読み込み(既存のまま)と、カメラ上に重ねるUIのDOM |
| `src/app.js` | 8th Wall パイプラインの起動(既存のまま)、現在の文字設定の保持、UI・ARシーン・録画の接続 |
| `src/scene.js` | 8th Wall カメラパイプラインモジュール。タップ配置・ドラッグ・ピンチ/回転・選択・写真キャプチャ・録画フレームフック |
| `src/text-plane.js` | opentype.js でフォントのアウトラインを取り出し、three.js で押し出した3D文字メッシュを生成 |
| `src/ui.js` | ツールバー・各シート・文字入力・シャッター・撮影結果・レシピ画面(DOMのみ、XRには依存しない) |
| `src/run-recorder.js` | [Font AR](https://github.com/NaohiroEnya/Font-AR) の録画モジュール。ARキャンバスを毎フレーム2Dキャンバスへ写して MediaRecorder で録画 |
| `src/fonts.js` / `colors.js` / `styles.js` | フォント・カラー・スタイルプリセットの定義 |
| `src/recipe.js` | レシピ ⇔ URLクエリ(`?text=&font=&color=&style=&size=`)の変換 |

### 仕組み

- **文字配置** — 透明な地面平面(影だけ映す ShadowMaterial)にレイキャストしてタップ位置を求め、そこに3D文字のグループを置く。向きはその時のカメラの水平方向だけを使い、文字は常に直立する。SLAMで空間に固定される
- **写真** — `scene.js` のパイプラインモジュールを XR8.Threejs の後に登録しているため、その `onRender` 時点でキャンバスにはカメラ映像+ARシーンが描画済み。そこで `toDataURL()` するので DOM の UI は写らない。選択リングだけはシーン内のオブジェクトなので撮影の瞬間だけ非表示にする
- **動画** — 同じ `onRender` から毎フレーム `run-recorder.js` の `captureFrame()` を呼んで録画用キャンバスへ描画。iOS Safari では MP4、それ以外は WebM
- **保存** — Web Share API でファイル共有できる環境(iOS Safari など)では共有シートから「画像を保存」/「ビデオを保存」、それ以外はダウンロード
- **レシピ** — 配置座標は含めず、文字の見た目の設定だけをURLクエリに載せる。未知のIDや範囲外のサイズは既定値に丸める

## デプロイ

`main`ブランチにpushすると、GitHub Actions経由でGitHub Pagesに自動デプロイされます(`.github/workflows/deploy.yml`、リポジトリ設定で Pages のソースを GitHub Actions にする必要があります)。
手動でビルドする場合は `npm run build` を実行し、`dist`フォルダを任意のホスティング先に配置してください。

## フォントについて

`src/assets/fonts/`に同梱しているフォントは、いずれも常用/教育漢字・かな・ASCIIの範囲でサブセット化しています(範囲外の文字は表示されません)。「コンデンス」は Noto Sans JP を横方向に62%に縮めて作っています。

- Noto Serif JP(明朝) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/notoserifjp/OFL.txt)
- Dela Gothic One(太ゴシック) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/delagothicone/OFL.txt)
- Noto Sans JP(ゴシック/コンデンス) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/notosansjp/OFL.txt)
- Zen Maru Gothic(丸ゴシック) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/zenmarugothic/OFL.txt)
- Yusei Magic(手書き) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/yuseimagic/OFL.txt)

## 既知の制約

- SLAM部分はコンパイル済みバイナリとして配布されており、ソースは非公開。将来のOS/ブラウザ更新で不具合が出た場合、自前での修正はできない
- 文字は地面(推定された床面)の上に立てて置く。壁や机の面への貼り付けには対応していない
- 「ゴシック」は通常ウェイト(400)。極細のゴシックは同梱していない
- 動画は映像のみ(音声なし)、最大60秒
- 現状は無料・非収益のコンテンツとしての利用を前提としている(利用ライセンスの詳細は配布元の [LICENSE](https://github.com/8thwall/engine/blob/main/LICENSE) を参照)
