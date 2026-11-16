# Font Photo AR

Webブラウザ上で、好きな文字を入力し、フォントと色を選んでAR空間に配置し、その場で写真を撮れるアプリです。
[Font AR](https://github.com/NaohiroEnya/Font-AR) をベースに、8th Wallの6DoF SLAM(`XR8.XrController`)による実カメラ位置トラッキングを使っているため、iOS Safari(WebXR未対応)でもネイティブアプリなしで、奥行きを含めた空間固定ができます。

## 機能

- 好きな文字を入力し、地面をタップしてAR空間に配置(設置済みの文字をタップすると選択)
- 配置前に4種類のフォント(ゴシック/明朝/手書き風/ポップ)から選択可能
- 配置前に9色のカラーから選択可能
- 配置前に4段階のサイズ(小/中/大/特大)から選択可能
- 配置済みの文字を選択すると、ドラッグでの位置の微調整、スライダーでのサイズ再調整、削除が可能
- 文字を配置した状態でシャッターボタンから写真を撮影可能
- 撮影した写真はブラウザ内(localStorage)に蓄積され、ギャラリーからいつでも閲覧・保存・削除可能

## 使い方

1. `npm install`
2. `npm run serve`
3. スマホ実機で確認する場合は[こちらの手順](https://8th.io/test-on-mobile)に従ってHTTPS経由で接続してください
4. 画面下部のテキスト欄に表示したい文字を入力し、フォント・色・サイズを選んでからカメラに映る地面をタップすると、その位置に文字が固定されます
5. 設置済みの文字をタップすると選択され、ドラッグで位置を移動、下部のスライダーでサイズを再調整、「この文字を削除」で削除できます(「完了」で選択解除)
6. 下部のシャッターボタンで撮影すると、左上のギャラリーアイコンから撮った写真を確認できます

## デプロイ

`main`ブランチにpushすると、GitHub Actions経由でGitHub Pagesに自動デプロイされます(`.github/workflows/deploy.yml`)。
手動でビルドする場合は `npm run build` を実行し、`dist`フォルダを任意のホスティング先に配置してください。

## 技術構成

- [three.js](https://threejs.org/) — 3Dシーンの描画
- [opentype.js](https://opentype.js.org/) — フォントファイルから文字のアウトラインを取得し、押し出し(extrude)で立体文字を生成
- [8th Wall Engine (Distributed Binary)](https://github.com/8thwall/engine) — SLAMによる実空間トラッキング。コンパイル済みバイナリとして`index.html`内でCDN読み込みしており、ソースは非公開
- [XRExtras](https://www.npmjs.com/package/@8thwall/xrextras) / [Landing Page](https://www.npmjs.com/package/@8thwall/landing-page) — 8th Wallのフレームワーク部分。こちらはMITライセンスでOSS化されている
- 写真の撮影は、AR描画後の`<canvas id="camerafeed">`をそのまま`toDataURL()`でキャプチャして実現(カメラ映像とAR文字が合成された1枚の絵になる)

## フォントについて

`src/assets/fonts/`に同梱しているフォントは、いずれもJouyou/Kyoiku-use漢字・かな・ASCIIの範囲でサブセット化しています(範囲外の文字は表示されません)。

- Noto Sans JP(ゴシック) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/notosansjp/OFL.txt)
- Noto Serif JP(明朝) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/notoserifjp/OFL.txt)
- Yusei Magic(手書き風) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/yuseimagic/OFL.txt)
- Hachi Maru Pop(ポップ) — [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/hachimarupop/OFL.txt)

## 既知の制約

- SLAM部分はコンパイル済みバイナリとして配布されており、ソースは非公開。将来のOS/ブラウザ更新で不具合が出た場合、自前での修正はできない
- 撮影した写真はブラウザのlocalStorageに保存されるため、ブラウザのデータを消去したり別の端末/ブラウザで開いたりすると引き継がれない
- 現状は無料・非収益のコンテンツとしての利用を前提としている(利用ライセンスの詳細は配布元の [LICENSE](https://github.com/8thwall/engine/blob/main/LICENSE) を参照)
