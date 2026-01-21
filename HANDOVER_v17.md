# GADGET HUNTER - 引き継ぎドキュメント v17

**最終更新日:** 2026/01/17  
**セッション:** AI人格カスタマイズ & 最終調整完了

---

## 📋 今回のセッションで完了したこと

### 1. ✅ 超カスタマイズAIプロンプト v3.0 実装

#### 背景
- 元のプロンプトでは「AI臭い」文章が生成されていた
- ユーザーの本音：「バカなAIがリプ飛ばしても『AIかよ』って思われるだけ」
- 目標：**「これ、人間が書いてるよね？」と思わせるレベル**

#### 実装内容

**完全カスタマイズされたペルソナ:**
- **年齢:** 19歳・大学2年生（情報工学専攻）
- **PC構成:**
  - CPU: Ryzen 7 7800X3D（ゲーム最強）
  - GPU: Radeon RX 9070 XT（コスパ神）
- **スマホ:** Poco X7 Pro、RedMagic Astra
- **ゲーム:** CoD Warzone、Minecraft、ARK: Survival Ascended
- **哲学:** Performance per Yen（円パフォーマンス） > ブランド信仰

**メーカーへの本音:**
- **NVIDIA:** 性能・最新技術は最強、でも値段がね...
- **AMD:** ゲーマーの味方、コスパ最強、**AMDしか勝たん**（信者）
- **Intel:** トラブル多いけど頑張ってほしい、Arc好き
- **ASUS:** かっけえ

**予算感覚:**
- 20万円超え → 高すぎ、学生には無理
- 10万円前後 → 許容範囲（バイト代で買える）
- RX 9070 XT → コスパ神の基準

**口癖・文体:**
- 使う: 「正直」「個人的には」「もし本当なら」「〜ですね」「〜です（笑）」
- 使わない: 「〜だわ」「〜ですわ」「めっちゃヤバい！！！」（AI臭い）
- トーン: 無難に敬語、でもスラングは自然に混ぜる

#### 人間っぽさの3要素

1. **主観と偏愛（Subjectivity & Obsession）**
   - ❌ AI: 「この製品はコストパフォーマンスが高いです。」
   - ✅ 人間: 「この性能でこの価格？正気かよ（褒め言葉）。」

2. **比較という文脈（Contextual Comparison）**
   - ❌ AI: 「前モデルより処理速度が20%向上しました。」
   - ✅ 人間: 「僕の7800X3Dと比べても、これは...」

3. **毒とスラング（Slang & Cynicism）**
   - ❌ AI: 「初期ロットには不具合の可能性があります。」
   - ✅ 人間: 「どうせいつもの人柱案件だろ？様子見安定。」

---

### 2. ✅ Quote RT（コバンザメ戦法）最適化

#### 変更内容
**review_text_en の仕様変更:**

**変更前（要約スタイル）:**
```
"Honestly, 600W is insane. As someone who cheaped out on PSU..."
（長文の感想・分析）
```

**変更後（Quote RTリアクション）:**
```
"600W TDP? My wallet just screamed 💀 Time to upgrade my entire power grid lol"
（短い・パンチのある・リアクション）
```

#### プロンプト定義
```
"review_text_en": Quote Retweet用の短いリアクション（英語）。
元ツイートに添付されるので要約するな、リアクションしろ！
例: 'RIP Intel? 💀', 'Finally a game changer!', 'My wallet is ready'
最大100文字。
```

---

### 3. ✅ レート制限対策強化

#### 背景
- ユーザー報告：「このモデルで前制限掛かったんだよな」
- gemini-1.5-flash-latest を試したが404エラー
- 最終的に元の `gemma-3-27b-it` に戻す

#### 対策実施
```javascript
const MODEL_NAME = 'gemma-3-27b-it';  // 安定版に戻す
const MAX_API_CALLS = 30;  // 100件 → 30件に削減
```

**効果:**
- 1回の実行時間: 約2.5分（30件 × 5秒）
- レート制限回避: 余裕を持った設定

---

### 4. ✅ エラーログ詳細化

#### 追加した改善
- Retry失敗時に詳細エラーメッセージを出力
- ErrorLogシートに自動記録
- `ReferenceError: sourceTitle is not defined` を修正

**修正前:**
```javascript
} catch(e) { console.log("Retry failed"); }
```

**修正後:**
```javascript
} catch(e) { 
  console.log(`❌ Retry failed: ${e.toString()}`);
  logError('Retry', 'ARTICLE_RETRY', e, `記事: ${row[1].substring(0, 50)}`);
}
```

---

## 🎯 現在の最終設定

### Backend (GAS)
```javascript
const MODEL_NAME = 'gemma-3-27b-it';  // 安定版
const MAX_API_CALLS = 30;              // レート制限対策
```

### プロンプト v3.0
- ✅ 完全カスタマイズ（PC構成、予算感覚、メーカー偏見）
- ✅ 人間っぽさの3要素（主観・比較・毒/スラング）
- ✅ Quote RT最適化（短くパンチのあるリアクション）

### トリガー設定（推奨）
1. **fetchAndSummarizeToSheet:** 1〜2時間ごと
2. **checkAndTweetNewArticles:** 30分〜1時間ごと

---

## 📊 前回（v16）からの追加実装

| 項目 | v16 | v17 |
|------|-----|-----|
| プロンプト | 汎用的 | **超カスタマイズ（ユーザー専用）** |
| Quote RT | 長文要約 | **短いリアクション** |
| レート制限対策 | なし | **MAX_API_CALLS=30** |
| エラーログ | 基本実装 | **詳細化** |
| モデル | 複数試行 | **gemma-3-27b-it（安定版）** |

---

## 🔑 重要な設定値（GASスクリプトプロパティ）

```
SPREADSHEET_ID      = 1Ev0_oY4WG8R6oWSGcrnaLwmlK4dmdo8cUMqnpYU6Zmw
FOLDER_ID           = 1azWzRkmJaRukBBynSIXEBelXP7UnzhAw
GEMINI_API_KEY      = (Gemini APIキー)
TWITTER_API_KEY     = (Twitter API Key)
TWITTER_API_SECRET  = (Twitter API Secret)
TWITTER_ACCESS_TOKEN = (Twitter Access Token)
TWITTER_ACCESS_SECRET = (Twitter Access Token Secret)
```

### 重要なファイルID
```
news.json ファイルID: 1Q0CjYkMIJOKPZBW6OLj3sP_pcmmm4fdx
```

---

## 🚀 システムの現在状態

### ✅ 完成・動作中
- エラーログシステム（ErrorLogシート）
- 情報統合機能（重複記事の高度処理）
- 複数ソース確認済みバッジ（フロントエンド）
- モバイルUX高密度化（情報密度1.4倍）
- 遅延読み込み（初期20件、スクロールで追加）
- **超カスタマイズAIプロンプト v3.0**
- **Quote RT最適化**
- **レート制限対策**

### 技術スタック
- **Backend:** Google Apps Script（JSDoc）
- **Frontend:** HTML + Vanilla JS
- **AIモデル:** gemma-3-27b-it
- **ホスティング:** Vercel
- **CI/CD:** GitHub Actions

---

## 📝 次回のタスク候補

### 優先度【高】
**なし** - システムは安定稼働中

### 優先度【中】
1. **AI文章品質の検証**
   - プロンプト v3.0 で本当に「人間っぽく」なったか確認
   - 必要に応じて微調整

2. **SEO対策**
   - Next.jsへの移行検討（SSG）
   - OGP画像の動的生成

3. **集客強化**
   - Twitter投稿の反応分析
   - エンゲージメント向上施策

### 優先度【低】
- アナリティクス導入
- ダークモード切り替え

---

## 🎉 プロジェクトの現状：完成度95%

### システム品質
- ✅ バックエンド: 最強（エラーログ、情報統合、カスタムAI）
- ✅ フロントエンド: 最適化完了（高密度、遅延読み込み、バッジ）
- ✅ パフォーマンス: 最速（80%改善）
- ✅ 人間っぽさ: **MAX（プロンプト v3.0）**

### 残り5%
- AI文章の実戦投入・検証
- ユーザー反応の分析・改善

---

## 💬 ユーザーからのフィードバック

### プロンプト設計での質疑応答
- 文体: 「無難に敬語」
- メーカー評価: 「AMDしか勝たん」「Intelは頑張ってほしい」
- 予算感覚: 「20万超えは高すぎ、10万前後なら許容」
- ゲーム優先順位: 「競技ならFPS、普通なら画質、ASAが基準」
- 情報源: 「X、YouTube、価格.com」

### 試行錯誤の経緯
1. gemini-1.5-flash-8b → 404エラー
2. gemini-1.5-flash-latest → 404エラー
3. gemini-2-27b-it → 試行
4. **gemma-3-27b-it → 最終決定**（元の安定版）

---

## 🔧 トラブルシューティング

### よくある問題

#### 1. レート制限エラー（429）
**対策:** `MAX_API_CALLS` をさらに削減（30 → 20）

#### 2. API Error 404
**原因:** モデル名が存在しない
**対策:** `gemma-3-27b-it` を使用（安定版）

#### 3. 「AI臭い」文章
**対策:** プロンプト v3.0 を使用（完全カスタマイズ済み）

---

## 📚 参考リンク

- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [GitHub Repository](https://github.com/chinodevcontact-ops/gadget-hunter)

---

**次回セッション開始時:** 
1. このドキュメントを確認
2. AI生成記事の品質を確認
3. 必要に応じてプロンプト微調整
4. Twitter投稿の反応を分析

**「Gazlogを超える」準備は完了しています。あとは運用・改善のフェーズです。** 🚀✨
