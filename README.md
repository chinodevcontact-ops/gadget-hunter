# ⚡️ GADGET HUNTER - Cyberpunk Leak Portal

ガジェットの最新リーク情報をAIが自動収集・翻訳・要約・発信する、完全自動運営のテックメディアです。

[![Security Status](https://img.shields.io/badge/Security-Hardened-green)](./SECURITY.md)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://gadget-hunter-xi.vercel.app/)

---

## 🛠 システムアーキテクチャ (完全自動フロー)

1. **GAS (Google Apps Script)**: 2時間ごとに海外RSSを監視し、Gemini 2.5 Flash で「俺」モードの記事を生成。
2. **Google Drive**: 生成されたデータを `news.json` として保持。
3. **GitHub Actions**: 2時間ごとにDriveからデータを取得し、GitHubリポジトリを更新。
4. **Vercel**: GitHubの更新を検知し、即座にフロントエンド（HTML/JS）を再デプロイ。
5. **X Bot**: 1時間ごとに最新記事を自動投稿。

## 🤖 19歳のガジェットオタク「俺」ペルソナ
このサイトの記事は、以下の性格を持つAIによって執筆されています。
- **専門知識**: Ryzen, Radeon, ゲーミングスマホ, マイクラの論理回路。
- **口調**: 「〜だね」「〜だよな」「正直微妙」など、砕けたタメ口。
- **信念**: コスパとロマンがない製品には厳しい。

## 📊 自動実行タイムライン
| 時刻 | 動作内容 |
|:---:|:---|
| 00分 | GAS記事取得 ➔ X投稿 ➔ GitHub Actions実行 ➔ Vercelデプロイ |
| 60分 | X投稿 (未投稿がある場合) |

## 🔒 セキュリティ機能

このプロジェクトは**エンタープライズレベルのセキュリティ対策**を実装しています。

### 実装済み対策
- ✅ **XSS対策**: HTML Sanitization + CSP (Content Security Policy)
- ✅ **API Key保護**: 環境変数 + ログマスキング
- ✅ **CORS制限**: 許可されたオリジンのみアクセス可能
- ✅ **DoS対策**: レート制限 + タイムアウト
- ✅ **入力検証**: URL検証 + データサニタイゼーション
- ✅ **セキュアOAuth**: 暗号学的に安全なnonce生成
- ✅ **エラーハンドリング**: 情報漏洩防止
- ✅ **キャッシュ改ざん検出**: チェックサム検証

詳細は [SECURITY.md](./SECURITY.md) をご覧ください。

## 🔗 リンク
- **本番サイト**: [https://gadget-hunter-xi.vercel.app/](https://gadget-hunter-xi.vercel.app/)
- **X (Twitter)**: []
- **セキュリティドキュメント**: [SECURITY.md](./SECURITY.md)

## 🏗 開発者向け

### セットアップ
```bash
# リポジトリをクローン
git clone https://github.com/chinodevcontact-ops/gadget-hunter.git
cd gadget-hunter

# Google Apps Scriptの設定
# 1. script.google.comでプロジェクト作成
# 2. backend/Code.ts の内容をコピー
# 3. スクリプトプロパティに以下を設定:
#    - SPREADSHEET_ID
#    - FOLDER_ID
#    - GEMINI_API_KEY
#    - TWITTER_API_KEY
#    - TWITTER_API_SECRET
#    - TWITTER_ACCESS_TOKEN
#    - TWITTER_ACCESS_SECRET

# Vercelにデプロイ
vercel --prod
```

### ディレクトリ構造
```
gadget-hunter/
├── backend/
│   ├── Code.ts          # GAS メインロジック
│   ├── appsscript.json  # GAS 設定
│   └── package.json
├── frontend/
│   ├── index.html       # フロントエンド
│   ├── .htaccess        # セキュリティヘッダー
│   └── data/
│       └── news.json    # 記事データ
├── vercel.json          # Vercel設定 + CORS
├── SECURITY.md          # セキュリティドキュメント
└── README.md
```

### 技術スタック
- **Backend**: Google Apps Script + Gemini API
- **Frontend**: Vanilla JS + CSS (No Framework)
- **Hosting**: Vercel (Edge Network)
- **Security**: CSP, CORS, XSS Protection, Rate Limiting

### ローカル開発
```bash
# シンプルなHTTPサーバーで起動
cd frontend
python -m http.server 8000

# または
npx serve .
```

### セキュリティチェック
```bash
# CSP検証
curl -I https://gadget-hunter-xi.vercel.app/

# XSS脆弱性テスト（開発環境のみ）
# ※本番環境では絶対に実行しないでください
```

## 🤝 コントリビューション

貢献は大歓迎です！以下の手順でPRを送ってください。

1. このリポジトリをFork
2. 新しいブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにPush (`git push origin feature/AmazingFeature`)
5. Pull Requestを作成

### セキュリティ上の問題を発見した場合
公開Issueは作成せず、[SECURITY.md](./SECURITY.md) の「脆弱性報告」セクションを参照してください。

## 📝 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) をご覧ください。

---

## 🎖️ バージョン履歴

### v18 (2026/01/18) - Security Hardened Edition
- ✅ 8つの重大な脆弱性を修正
- ✅ エンタープライズレベルのセキュリティ対策を実装
- ✅ SECURITY.md を追加

### v17 (2026/01/17) - AI Persona Edition
- 超カスタマイズAIプロンプト v3.0 実装
- Quote RT最適化

### v16 以前
- 詳細は [HANDOVER_v17.md](./HANDOVER_v17.md) を参照

---

© 2026 GADGET HUNTER. Powered by AI & High-Octane Coffee.
