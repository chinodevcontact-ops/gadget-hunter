# X（Twitter）投稿の承認制フロー

自動投稿をやめ、**承認制**に変更しました。GAS が「投稿候補」をキューに追加し、あなたがアクティブなときに承認 UI から「投稿する」で X に投稿します。

---

## 流れ

1. **GAS**  
   `fetchAndSummarizeToSheet()` → `checkAndTweetNewArticles()` がこれまで通り実行される  
   → ただし **投稿はせず**、スプレッドシートの **「PendingTweets」シート** に承認待ちとして追加される  
   → メインシートの該当行は「承認待ち」になる（同じ記事が重複してキューに入らない）

2. **あなた**  
   承認用 Web アプリ（下記）を開く  
   → 承認待ち一覧を確認  
   → 「投稿する」で X に投稿、「破棄」でキューから削除

3. **投稿後**  
   PendingTweets の該当行は「posted」になり、メインシートの該当列は「2段階投稿済み」または「QuoteRT済み」に更新される。

---

## 承認用 UI の使い方

### 1. GAS プロジェクトに HTML を追加

- リポジトリの **`backend/ApprovalUI.html`** を GAS のスクリプトエディタに追加する  
  - エディタで「＋」→「HTML」→ ファイル名を **`ApprovalUI`** にする  
  - 中身を `backend/ApprovalUI.html` の内容で貼り付けて保存  

（clasp で push している場合は、`ApprovalUI.html` を backend フォルダに含めて push すれば同じように追加されます。）

### 2. Web アプリとしてデプロイ

1. GAS エディタで **「デプロイ」→「新しいデプロイ」**
2. 種類で **「ウェブアプリ」** を選択
3. 設定  
   - **実行ユーザー:** 自分  
   - **アクセス:** **自分のみ**（承認画面は自分だけが開けるようにする）
4. 「デプロイ」して **ウェブアプリの URL** をコピー

### 3. 日常の使い方

- 承認したいときに、その URL をブラウザで開く  
- 一覧で内容を確認し、「投稿する」または「破棄」を選択  
- 必要なら「一覧を更新」で再取得

---

## スプレッドシート

- **PendingTweets** シートは `checkAndTweetNewArticles()` の初回実行時に自動作成されます。  
- 列: type, mainText, replyText, quoteTweetId, title, url, articleRowIndex, createdAt, status, tweetedAt  
- 承認待ちは `status = pending`。投稿後は `posted`、破棄後は `discarded`。

---

## 注意

- 承認 UI の URL は **あなただけがアクセスできる**設定にしてください（「自分のみ」）。  
- X の bot/AI ポリシーに合わせて、**人が確認してから投稿する**運用にしています。
