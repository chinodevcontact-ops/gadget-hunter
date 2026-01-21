# 🔒 GADGET HUNTER - セキュリティドキュメント

**最終更新日:** 2026/01/18  
**バージョン:** v18 (Security Hardened)

---

## 📋 実装済みセキュリティ対策

### ✅ 1. XSS (Cross-Site Scripting) 対策

#### フロントエンド
- **HTMLエスケープ関数**：すべてのユーザー入力とAPI取得データをエスケープ
- **HTML Sanitization**：許可されたタグのみを表示（ホワイトリスト方式）
- **CSP (Content Security Policy)**：スクリプト実行を制限
  ```html
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://utteranc.es; ...
  ```

#### バックエンド (GAS)
- **escapeHtml()関数**：GAS側でもHTML特殊文字をエスケープ
- AI生成コンテンツのサニタイゼーション

---

### ✅ 2. API Key保護

#### 実装内容
- GAS Script Propertiesで環境変数として管理
- ログ出力から機密情報を自動除外
  ```javascript
  // 自動的に以下をマスク
  - API Keys
  - Tokens
  - Secrets
  - Passwords
  ```

#### 推奨事項
⚠️ **重要**: GASプロジェクトの共有設定を確認してください
```
✅ 正しい設定: 「編集権限 = 自分のみ」
❌ 危険な設定: 「リンクを知っている全員」
```

---

### ✅ 3. CORS & セキュリティヘッダー

#### Vercel設定 (vercel.json)
```json
{
  "headers": [
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "X-Frame-Options",
      "value": "SAMEORIGIN"
    },
    {
      "key": "Strict-Transport-Security",
      "value": "max-age=31536000; includeSubDomains"
    }
  ]
}
```

#### CORS制限
- `/data/news.json` へのアクセスは `https://gadget-hunter-xi.vercel.app` のみ許可
- 他のオリジンからのアクセスはブロック

---

### ✅ 4. DoS攻撃対策

#### レート制限
- **GAS側**: MAX_API_CALLS = 30件/実行
- **フロントエンド**: リクエストタイムアウト10秒
- **Vercel**: Cache-Control ヘッダーで頻繁なリクエストを抑制

#### キャッシュ戦略
```javascript
// 5分間のクライアントサイドキャッシュ
Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600
```

---

### ✅ 5. 入力検証

#### URL検証
```javascript
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
  } catch (e) {
    return false;
  }
}
```

#### RSS Parsing
- 正規表現でのXML処理（XXE攻撃対策）
- 不正なURLは自動的にスキップ

---

### ✅ 6. OAuth署名の強化

#### 変更点
```javascript
// 修正前（脆弱）
oauth_nonce: Math.random().toString(36).substring(2)

// 修正後（セキュア）
oauth_nonce: generateSecureNonce()  // UUID + タイムスタンプ + SHA-256
```

---

### ✅ 7. エラーハンドリング

#### 情報漏洩防止
```javascript
// 外部には詳細を返さない
if (errorCode === 429) {
  throw new Error('Rate limit exceeded');  // 一般的なメッセージ
} else if (errorCode >= 500) {
  throw new Error('External service error');
} else {
  throw new Error('API request failed');
}

// 詳細はログのみに記録
console.error(`❌ Gemini API Error: ${errorCode}`);
```

---

### ✅ 8. キャッシュ改ざん検出

#### チェックサム検証
```javascript
function getCacheChecksum(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}
```

---

## 🚨 まだ対応していない脆弱性

### ⚠️ 1. GASプロジェクトのアクセス制御
**リスク**: 共有設定ミスによるAPI Key漏洩

**対策（手動）**:
1. [GASプロジェクト](https://script.google.com/home)を開く
2. 右上「共有」→「編集権限を自分のみに設定」

---

### ⚠️ 2. Google Driveファイルの公開範囲
**リスク**: `news.json`のファイルIDが推測される可能性

**対策（推奨）**:
```javascript
// Code.ts: Line 939
// 現在の設定
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

// より安全な設定（要検討）
// file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
```

---

### ⚠️ 3. HTTPS強制
**対策済み**: Vercelでは自動的にHTTPS強制

---

## 🛡️ セキュリティベストプラクティス

### 定期的な監視
- [ ] ErrorLogシートを週1回確認
- [ ] GASの実行ログを確認（異常なAPI呼び出しをチェック）
- [ ] Vercelのアクセスログを確認

### 定期的な更新
- [ ] 依存ライブラリの更新（Vercel, GAS）
- [ ] Twitter/Gemini APIの変更をチェック
- [ ] セキュリティパッチの適用

---

## 🔍 脆弱性報告

もし新たなセキュリティ問題を発見した場合は、以下の方法で報告してください：

1. **GitHubのIssue**（公開情報のみ）
2. **メール**（機密情報）: [連絡先を記載]

---

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Apps Script Security Best Practices](https://developers.google.com/apps-script/guides/security)
- [Vercel Security Headers](https://vercel.com/docs/concepts/edge-network/headers)
- [CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**最後に**: セキュリティは継続的なプロセスです。定期的な見直しと更新を忘れずに！
