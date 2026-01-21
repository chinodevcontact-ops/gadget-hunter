# 🚨 インシデント対応記録：X API Bot Detection

**発生日時**: 2026年1月20日  
**インシデント種別**: X (Twitter) アカウント制限（Bot判定による自動制限）  
**重大度**: ⚠️ **HIGH** - サービス継続に影響  

---

## 📊 根本原因分析（Root Cause Analysis）

### 1. 機械的動作パターンの検出
```typescript
// ❌ 問題のコード（修正前）
Utilities.sleep(5000); // 正確に5秒 = ボット判定
```

**問題点**:
- 人間は「正確に5.000秒」で行動しない
- 4.8秒だったり、6.1秒だったりする「ゆらぎ」がある
- Xのアルゴリズムは「正確すぎる動作」を検出する

### 2. 複数クライアントからの同時アクセス
```
同一IP/時間帯から：
├─ Browser（Chrome/Windows）: Cookie認証でXを閲覧中
└─ GAS Script: OAuth 1.0a認証でAPI投稿

→ Xの検知システム: 「アカウント乗っ取り」または「ボットネット」と判定
```

### 3. 高密度のアクション（Actions Per Minute）
```
投稿密度:
メイン投稿 → (5秒) → リプライ投稿
+ ブラウザでの「いいね」「スクロール」

→ 人間の行動閾値を超えた
```

---

## 🛠️ 実施した対策

### ✅ コード修正（Anti-Bot Detection）

```typescript
/**
 * 人間らしいランダムな待機時間を生成
 * @param {number} minMs - 最小待機時間
 * @param {number} maxMs - 最大待機時間
 */
function humanLikeSleep(minMs, maxMs) {
  const sleepTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`⏳ Human-like cooling down (${(sleepTime / 1000).toFixed(1)}s)...`);
  Utilities.sleep(sleepTime);
}

// 使用例:
humanLikeSleep(30000, 90000); // 30〜90秒のランダム待機
```

### 修正箇所

| 箇所 | 修正前 | 修正後 | 理由 |
|------|--------|--------|------|
| API呼び出し後 | `5秒固定` | `10〜30秒ランダム` | API Rate Limit + Bot検知回避 |
| Gemini呼び出し後 | `5秒固定` | `15〜45秒ランダム` | Gemini API制限対策 |
| **X投稿間（Stage 1→2）** | `5秒固定` | `30〜90秒ランダム` | **★最重要：Bot検知回避** |

---

## ⏳ リカバリ手順（Recovery Protocol）

### Phase 1: 即時停止（完了）
- ✅ GASトリガーの削除（手動で実施すること）
- ✅ コードの修正完了（デプロイは**72時間後まで禁止**）

### Phase 2: 冷却期間（現在進行中）
**期間**: 最低 **72時間（3日間）**  
**開始**: 2026年1月20日  
**解除予定**: 2026年1月23日以降  

**この期間中、厳守すること**:
```
❌ APIを一切叩かない
❌ ブラウザでツイート・いいね・RTをしない
❌ 異議申し立て（Appeal）を送らない（逆効果）
✅ 完全放置（ログアウト推奨）
```

### Phase 3: 再開手順（72時間後）
1. **テスト投稿**（手動）:
   - ブラウザから手動で1ツイート
   - 制限解除を確認

2. **スクリプトのテスト実行**:
   - **テスト用アカウント**で動作確認
   - メインアカウントでは**絶対に試さない**

3. **段階的な運用再開**:
   - 初日: 1日1〜2記事のみ
   - 2日目: 1日3〜5記事
   - 1週間後: 通常運用（1日10記事程度）

---

## 🔒 再発防止策（Permanent Measures）

### 1. 開発環境と本番環境の完全分離
```
開発時: テスト用アカウント（捨て垢）を使用
本番時: メインアカウントを使用
        ただし、スクリプト実行中はブラウザを閉じる
```

### 2. 投稿頻度の制限
```typescript
// 1日の最大投稿数を制限
const MAX_TWEETS_PER_DAY = 10;
const tweetsToday = getTweetCountToday(); // 実装必要
if (tweetsToday >= MAX_TWEETS_PER_DAY) {
  console.log("⚠️ Daily tweet limit reached. Skipping...");
  return;
}
```

### 3. エラーハンドリングの強化
```typescript
try {
  postMainText(tweetText);
} catch (e) {
  if (e.message.includes('429')) {
    console.log('🚨 Rate Limit detected. Stopping execution.');
    throw new Error('RATE_LIMIT_STOP'); // トリガーを停止させる
  }
}
```

### 4. モニタリングダッシュボード
- 1日の投稿数をログに記録
- API呼び出し回数の監視
- エラー率の監視

---

## 📚 教訓（Lessons Learned）

### ❌ やってはいけないこと
1. **固定値のsleep**: 機械的動作の典型例
2. **ブラウザとAPI同時使用**: フィンガープリント不整合
3. **高頻度投稿**: 人間の行動閾値を考慮していない
4. **本番環境での開発**: インシデントリスク大

### ✅ やるべきこと
1. **ランダムな待機**: 人間らしさの模倣
2. **段階的な運用**: プラットフォームへの「慣らし」
3. **テスト環境の確保**: 捨て垢での検証
4. **ログと監視**: 異常の早期検知

---

## 🎯 次のアクション

### 今すぐ（手動）
- [ ] GAS Apps Scriptのダッシュボードを開く
- [ ] トリガー一覧から全てのトリガーを削除
- [ ] Xアカウントからログアウト

### 72時間後（2026/01/23以降）
- [ ] ブラウザから手動でテスト投稿
- [ ] 制限解除を確認
- [ ] テスト用アカウントでスクリプト動作確認
- [ ] 段階的に運用再開

### 将来的に
- [ ] 投稿数制限機能の実装
- [ ] エラーハンドリングの強化
- [ ] モニタリングダッシュボードの構築

---

## 📞 サポート連絡先（72時間後も制限が続く場合）

**X Support**: https://help.twitter.com/forms/platform  
**報告内容**（テンプレート）:
```
Subject: API開発中の誤動作について

I am developing an automated tech news posting system using X API.
During testing, my script may have triggered rate limits due to 
fixed-interval requests (5 seconds). I have since modified the code 
to use randomized delays (30-90 seconds) and implemented proper 
rate limiting. I apologize for any inconvenience caused.

Account: @your_handle
Issue: Temporary restriction
Date: 2026-01-20
```

---

**重要**: このインシデントはビジネスリスクだ。プラットフォームは「神」であり、我々はその庭で遊ばせてもらっているに過ぎない。アルゴリズムに喧嘩を売るな。アルゴリズムに「人間だ」と信じ込ませるのが、自動化エンジニアの腕の見せ所だ。

**今は大人しく待機しろ。それが最善のデバッグだ。**
