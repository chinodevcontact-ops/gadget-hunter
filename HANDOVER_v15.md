# GADGET HUNTER - 引き継ぎドキュメント v15

**最終更新日:** 2026/01/16  
**セッション:** プロジェクト構造整理 & セキュリティ強化 & Task B実装完了

---

## 📋 今回のセッションで完了したこと

### 1. ✅ プロジェクト構造の整理
- **backend/** フォルダ: Google Apps Script関連ファイル
  - `Code.ts`: メインスクリプト（JSDoc版）
  - `appsscript.json`: GAS設定
  - `.clasp.json`: clasp設定（`.gitignore`で除外済み）
  - `package.json`, `tsconfig.json`: TypeScript/Node.js設定
  
- **frontend/** フォルダ: Webサイト関連ファイル
  - `index.html`: メインHTML
  - `data/news.json`: ニュースデータ（GitHub Actionsで更新）
  - `homepage2.txt`: バックアップ？

- **その他:**
  - `.gitignore`: セキュリティファイルを除外
  - `vercel.json`: Vercel設定（Root Directory: frontend）
  - `.github/workflows/update-news.yml`: GitHub Actions（1時間ごとに`news.json`更新）

### 2. ✅ セキュリティ強化
- **APIキー・トークンをPropertiesServiceに移行**
  - ハードコードされていた機密情報を削除
  - `getConfig(key)` 関数で取得する方式に変更

**GASのスクリプトプロパティに設定が必要:**
```
GEMINI_API_KEY = (Gemini APIキー)
SPREADSHEET_ID = (スプレッドシートID)
FOLDER_ID = (Google DriveフォルダID)
TWITTER_API_KEY = (Twitter API Key)
TWITTER_API_SECRET = (Twitter API Secret)
TWITTER_ACCESS_TOKEN = (Twitter Access Token)
TWITTER_ACCESS_SECRET = (Twitter Access Token Secret)
```

### 3. ✅ TypeScript → JSDoc対応
- **clasp**のTypeScriptコンパイル問題を解決
- TypeScriptの型注釈をJSDocコメントに変更
- `// @ts-nocheck`でVS Codeのエラー表示を無効化
- clasp pushが正常に動作するように修正

### 4. ✅ Task B: 2段階投稿実装
**シャドウバン回避戦略:**
- `postMainText(text)`: テキストのみを投稿
- 5秒待機
- `postReplyUrl(text, replyToId)`: URLをリプライで投稿

**実装箇所:** `checkAndTweetNewArticles()` 関数

### 5. ✅ 記事上限を300件に増加
- **旧:** 100件（ヘッダー1 + データ100 = 101行）
- **新:** 300件（ヘッダー1 + データ300 = 301行）
- `cleanupAndSave()` 関数で古い記事を自動削除

### 6. ✅ キャッシュ時間を5分に短縮
- **旧:** 30分
- **新:** 5分
- `frontend/index.html` の `CACHE_DURATION` を変更

### 7. ✅ バグ修正
- `cleanupAndSave()` 関数の削除ロジックを修正
  - 旧: `if (lastRow > 100) sheet.deleteRows(2, lastRow - 100)`
  - 新: `if (lastRow > 301) sheet.deleteRows(2, lastRow - 301)`

---

## 🚨 現在の問題・未解決事項

### 1. ⚠️ Vercel 404エラー（修正済み？）
- **原因:** プロジェクト構造変更により、`index.html`が`frontend/`フォルダに移動
- **対策:** `vercel.json`を作成してRoot Directoryを`frontend`に指定
- **状況:** プッシュ済み。Vercelの再デプロイを待つ or 手動でRoot Directory設定

### 2. ⚠️ news.jsonが更新されていない問題
- **症状:** スプレッドシートには1/16のデータがあるが、`news.json`は93件のまま
- **考えられる原因:**
  1. GASの`saveJsonToDrive()`が実行されていない
  2. Google DriveのファイルIDが間違っている
  3. GitHub ActionsのファイルIDと不一致

**確認が必要:**
- Google Driveの`news.json`ファイルの最終更新日時
- ファイルID: `1hteuEBEmsH0zThg-xmBPH7IYkwbnHVDA`が正しいか
- GASエディタで`fetchAndSummarizeToSheet`を手動実行して動作確認

---

## 📁 プロジェクト構成

```
gadget-hunter/
├── backend/                 # Google Apps Script (GAS)
│   ├── Code.ts             # メインスクリプト (JSDoc版)
│   ├── appsscript.json     # GAS設定
│   ├── .clasp.json         # clasp設定 (gitignore)
│   ├── package.json        # Node.js依存関係
│   └── tsconfig.json       # TypeScript設定
│
├── frontend/               # Webサイト
│   ├── index.html          # メインHTML
│   ├── data/
│   │   └── news.json       # ニュースデータ (GitHub Actions更新)
│   └── homepage2.txt       # バックアップ？
│
├── .github/
│   └── workflows/
│       └── update-news.yml # GitHub Actions (1時間ごと)
│
├── .gitignore              # Git除外設定
├── vercel.json             # Vercel設定
└── README.md
```

---

## 🔧 技術スタック

### Backend (GAS)
- **言語:** JavaScript (JSDoc型注釈)
- **実行環境:** Google Apps Script
- **デプロイ:** `clasp push`
- **主な機能:**
  - RSSフィード取得（10サイト）
  - Gemini AIで記事生成（日本語・英語）
  - スプレッドシート保存
  - Twitter自動投稿（2段階投稿）
  - Google Driveに`news.json`保存

### Frontend
- **言語:** HTML + JavaScript (Vanilla)
- **ホスティング:** Vercel
- **主な機能:**
  - ニュース表示（カード形式）
  - 検索・フィルター機能
  - 言語切り替え（日本語・英語）
  - キャッシュ機能（5分間）

### CI/CD
- **GitHub Actions:** 1時間ごとに`news.json`をGoogle Driveから取得
- **Vercel:** GitHubプッシュで自動デプロイ

---

## 🔑 重要な設定値

### GAS設定 (Code.ts)
```javascript
const JSON_FILE_NAME = 'news.json';
const MY_WEBSITE_URL = 'https://gadget-hunter-xi.vercel.app/';
const MODEL_NAME = 'gemma-3-27b-it';
const MAX_API_CALLS = 100;  // 1回の実行で最大100件
```

### フィルター設定
```javascript
const STRICT_FILTER = {
  MIN_LENGTH: 20,
  REQUIRE_MEDIA_OR_TAG: true,
  REQUIRED_KEYWORDS: /RTX|GTX|GeForce|Radeon|Ryzen|.../i
};
```

### 記事上限
- スプレッドシート: 301行（ヘッダー1 + データ300）
- `news.json`: 最大300件

### キャッシュ時間
- フロントエンド: 5分

---

## 📝 次回のタスク候補

1. **news.json更新問題の解決**
   - Google DriveのファイルID確認
   - GASの`saveJsonToDrive()`動作確認
   - GitHub Actionsのログ確認

2. **Vercel 404エラーの最終確認**
   - デプロイ状況確認
   - 必要に応じてRoot Directory手動設定

3. **GASのスクリプトプロパティ設定**
   - 7つのAPIキー・IDを設定
   - 手動実行でテスト

4. **機能追加・改善案**
   - Twitter投稿の自動化テスト
   - エラーハンドリング強化
   - ログ機能の充実

---

## 🎯 現在の状態

- ✅ コード: 完成・プッシュ済み
- ✅ clasp push: 成功
- ⚠️ Vercel: 404エラー（再デプロイ待ち）
- ⚠️ news.json: 更新されていない（要調査）
- ❓ GASスクリプトプロパティ: 設定状況不明

---

## 📌 メモ

- `backend/Code.ts` は JSDoc版（clasp互換性のため）
- TypeScriptの型チェックは `// @ts-nocheck` で無効化
- `types.d.ts` は削除済み（claspエラーの原因）
- Gitのコミット履歴:
  - `6c02b69`: Vercel config追加
  - `a2e8f02`: メジャーリファクタリング

---

**次回セッション開始時:** このドキュメントを確認して、未解決の問題から着手してください。
