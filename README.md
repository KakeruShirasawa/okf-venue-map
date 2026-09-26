# オクトーバーフェスト 会場MAP（LINEミニアプリ / LIFF）

オクトーバーフェスト各会場の「会場マップ・ブース/メニュー・日別スケジュール・開催概要」を表示する LINE ミニアプリ。

- フロント：GitHub Pages（このリポジトリ）
- データ：Google スプレッドシート ＋ Google Apps Script（`gas/`）
- 画像：Google ドライブ「①オクトーバーフェスト/05_画像素材/2026年画像/2026豊洲」配下のブース別フォルダ

```
index.html / style.css / app.js   画面
config.js                         LIFF_ID・GAS_URL の設定
assets/                           会場マップ・ヘッダー・アイコン
data/fallback.json                GAS に繋がらない時の予備データ（HP掲載内容 2026/9/26 時点）
gas/Code.gs                       スプレッドシートAPI（Apps Script にコピー。初期データは data/fallback.json から読込）
```

## 運用（メニュー・スケジュールの更新）
スプレッドシートを編集するだけ。5分以内にアプリへ反映（すぐ反映したい時は GAS で `clearCache` を実行）。

| シート | 内容 | よく触る列 |
|---|---|---|
| venues | 会場。新会場は1行追加して `active=TRUE` | map_image, hours, drive_folder_id |
| booths | ブース | catch, logo_url |
| menus | メニュー | name, price, description, image_url, start_date, visible |
| spots | MAPのピン（x,y＝画像左上からの％） | x, y, description |
| schedule | 日別のステージ・企画 | date, time, title |
| days | 日ごとの「今日の見どころ」 | highlight |
| photos | ブース写真（`syncDrivePhotos` で自動生成） | visible |
| copy | アプリ内文言 | value |

- `image_url` は Drive の共有リンクをそのまま貼ってもOK（自動で表示用URLに変換）
- 期間限定メニューは `start_date` を入れると「9/29〜」バッジ表示
- 写真：Drive のブース別フォルダに入れて `syncDrivePhotos` を実行

## 新しい会場を追加する時
1. `assets/` に会場マップ画像を追加（例 `map-shiba.jpg`）
2. venues に1行追加（venue_id, map_image=`assets/map-shiba.jpg`, 期間など）
3. booths / menus / spots / schedule / days に venue_id を付けて追加
4. 会場が2つ以上 active の時は右上に会場切替が表示。`?venue=shiba` で直接開けます
