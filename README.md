# ⚡️ GADGET HUNTER - Cyberpunk Leak Portal

ガジェットの最新リーク情報をAIが自動収集・翻訳・要約・発信する、完全自動運営のテックメディアです。



---

## 🛠 システムアーキテクチャ (完全自動フロー)

1. **GAS (Google Apps Script)**: 2時間ごとに海外RSSを監視し、Gemini 1.5 Flash で「俺」モードの記事を生成。
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

## 🔗 リンク
- **本番サイト**: [https://gadget-hunter-xi.vercel.app/](https://gadget-hunter-xi.vercel.app/)
- **X (Twitter)**: [あなたのXアカウントへのリンク]

## 🏗 開発者向け
- **Data Source**: `data/news.json`
- **Main Logic**: Google Apps Script
- **Frontend**: Vanilla JS + CSS (Neon Cyberpunk Theme)

---
© 2026 GADGET HUNTER. Powered by AI & High-Octane Coffee.
