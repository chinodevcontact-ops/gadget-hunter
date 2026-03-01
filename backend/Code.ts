// @ts-nocheck
/**
 * ==========================================
 * GADGET HUNTER - System v14.1 (JSDoc Edition)
 * Feat. Security/JSDoc Typing/Task B (2-Stage Tweet)
 * ==========================================
 */

/**
 * @typedef {Object} RSSItem
 * @property {string} title
 * @property {string} link
 * @property {string} desc
 */

/**
 * @typedef {Object} GeminiResponse
 * @property {string} title_jp
 * @property {string} title_en
 * @property {string[]} summary_points
 * @property {string[]} summary_points_en
 * @property {string} body_text
 * @property {string} body_text_en
 * @property {string} review_text
 * @property {string} review_text_en
 */

// ▼ 設定定数
const JSON_FILE_NAME = 'news.json';
const MY_WEBSITE_URL = 'https://gadget-hunter-xi.vercel.app/';
const MODEL_NAME = 'gemini-2.5-flash';

// ▼ データクリーンアップ設定
const CLEANUP_DAYS_TO_KEEP = 30; // 30日以上古い記事を削除
const CLEANUP_MAX_ROWS = 300;    // 最大300行まで保持（ヘッダー除く）
// 移行の合図: news.json が重い / GitHub Diff が辛い / GAS メモリ制限に当たり始めたら DB・月次アーカイブを検討

// ==========================================
// 🧠 プロンプト設定定数
// ==========================================
const PERSONA_CONFIG = {
  age: 19,
  pc: { cpu: 'Ryzen 7 7800X3D', gpu: 'RX 9070 XT' },
  mobile: ['Poco X7 Pro', 'RedMagic Astra'],
  games: ['CoD Warzone', 'Minecraft', 'ARK: Survival Ascended'],
  philosophy: 'Performance per Yen > Brand Loyalty',
  budget: { tooExpensive: '20万円', acceptable: '10万円前後', godTier: 'RX 9070 XT' },
  brands: {
    nvidia: '性能・最新技術・クリエイティブなら最強',
    amd: 'ゲーマーの味方、コスパ最強、AMDしか勝たん',
    intel: 'トラブルあったけど頑張ってほしい、グラボは好き',
    asus: 'かっけえ'
  }
};

/**
 * 設定値を取得するヘルパー関数（セキュリティ強化版）
 * @param {string} key 
 * @return {string}
 */
function getConfig(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key) || '';
  if (!value) {
    console.warn(`⚠️ Config key "${key}" is not set`);
  }
  return value;
}

/**
 * HTMLエスケープ関数（XSS対策）
 * @param {string} unsafe 
 * @return {string}
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
}

/**
 * URL検証関数（インジェクション対策）
 * @param {string} url 
 * @return {boolean}
 */
function isValidUrl(url) {
  if (!url) return false;
  // GASではnew URL()が動作しないケースがあるため正規表現で検証
  return /^https?:\/\/[^\s"'<>]+$/i.test(url.trim());
}

/**
 * 安全なOAuth Nonce生成（暗号学的に安全な乱数）
 * @return {string}
 */
function generateSecureNonce() {
  const bytes = Utilities.getUuid() + Date.now() + Math.random();
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes))
    .substring(0, 32);
}

/**
 * 人間らしいランダムな待機時間を生成（Anti-Bot Detection）
 * @param {number} minMs - 最小待機時間（ミリ秒）
 * @param {number} maxMs - 最大待機時間（ミリ秒）
 * @return {void}
 */
function humanLikeSleep(minMs, maxMs) {
  const sleepTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`⏳ Human-like cooling down (${(sleepTime / 1000).toFixed(1)}s)...`);
  Utilities.sleep(sleepTime);
}

// ▼ ノイズ除去用フィルター設定
const STRICT_FILTER = {
  MIN_LENGTH: 20,
  REQUIRE_MEDIA_OR_TAG: true,
  REQUIRED_KEYWORDS: /RTX|GTX|GeForce|Radeon|Ryzen|Core|Intel|AMD|Snapdragon|Dimensity|Exynos|Apple|M4|M5|A18|A19|GB|TB|MHz|GHz|Benchmark|Cinebench|Geekbench|3DMark|Leak|Rumor|Specs|Price|Release|Launch|Driver|Update|Windows|Android|iOS|AI|NVIDIA|TSMC|Samsung|Pixel|Xperia|ASUS|MSI/i
};

/**
 * 2つのテキストの類似度を計算（Jaccard係数ベース）
 * @param {string} text1 
 * @param {string} text2 
 * @return {number} 類似度 (0.0 ~ 1.0)
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  // 正規化：小文字化、記号削除、単語分割
  const normalize = (text) => {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // 記号を空白に
      .split(/\s+/)               // 空白で分割
      .filter(w => w.length > 2); // 2文字以下の単語を除外
  };

  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  // Jaccard類似度: 積集合 / 和集合
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = words1.size + words2.size - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * 過去24時間の記事タイトルと詳細を取得
 * @param {Sheet} sheet 
 * @return {Array<{title: string, url: string, summary: string, content: string, rowIndex: number}>}
 */
function getRecentTitles(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues(); // 全カラム取得

  const results = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const date = new Date(row[0]);
    if (date >= oneDayAgo && row[1]) {
      results.push({
        title: row[1],
        url: row[2],
        summary: row[3] || '',
        content: row[4] || '',
        leakScore: row[5] || 50,
        rowIndex: i + 2  // スプレッドシートの実際の行番号（ヘッダー分+1、配列インデックス分+1）
      });
    }
  }
  return results;
}

/**
 * 既存記事と重複していないかチェック（重複時は既存記事データを返す）
 * @param {string} newTitle 新しい記事のタイトル
 * @param {Array} recentTitles 最近の記事リスト
 * @param {number} threshold 類似度閾値（デフォルト: 0.7）
 * @return {Object|null} 重複記事データ または null
 */
function findDuplicate(newTitle, recentTitles, threshold = 0.7) {
  for (const article of recentTitles) {
    const similarity = calculateSimilarity(newTitle, article.title);
    if (similarity >= threshold) {
      console.log(`🔄 重複検出 (類似度: ${(similarity * 100).toFixed(1)}%): ${article.title.substring(0, 50)}...`);
      return { ...article, similarity };
    }
  }
  return null;
}

/**
 * エラーログをスプレッドシートに記録（セキュリティ強化版）
 * @param {string} source エラー発生元（サイト名、関数名など）
 * @param {string} errorType エラーの種類（RSS_FETCH, API_CALL, TWITTER_POST など）
 * @param {Error|string} error エラーオブジェクトまたはメッセージ
 * @param {string} context 追加のコンテキスト情報
 */
function logError(source, errorType, error, context = '') {
  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    let errorSheet = ss.getSheetByName('ErrorLog');

    // ErrorLogシートが存在しない場合は作成
    if (!errorSheet) {
      errorSheet = ss.insertSheet('ErrorLog');
      errorSheet.appendRow(['タイムスタンプ', '発生元', 'エラー種別', 'エラー内容', '詳細', 'ステータス']);
      errorSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f3f3f3');
    }

    const timestamp = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    // ✅ セキュリティ：機密情報をログから除外
    let errorMessage = error.toString ? error.toString() : String(error);

    // API Keyやトークンが含まれていないか検査
    const sensitivePatterns = [
      /api[_-]?key[=:]\s*[\w-]+/gi,
      /token[=:]\s*[\w-]+/gi,
      /secret[=:]\s*[\w-]+/gi,
      /password[=:]\s*[\w-]+/gi,
      /bearer\s+[\w-]+/gi
    ];

    sensitivePatterns.forEach(pattern => {
      errorMessage = errorMessage.replace(pattern, '[REDACTED]');
    });

    // コンテキストも同様にサニタイズ
    sensitivePatterns.forEach(pattern => {
      context = context.replace(pattern, '[REDACTED]');
    });

    errorSheet.appendRow([
      timestamp,
      source,
      errorType,
      errorMessage,
      context,
      '未対応'
    ]);

    // ✅ コンソールログも機密情報を除外
    console.error(`❌ [${errorType}] ${source}: ${errorMessage.substring(0, 100)}`);
  } catch (e) {
    // エラーログ記録自体が失敗した場合は簡潔に出力（機密情報を含めない）
    console.error(`🚨 Failed to log error: ${e.message}`);
  }
}

// ----------------------------------------------------
// 1. ニュース取得＆AI執筆メイン
// ----------------------------------------------------
function fetchAndSummarizeToSheet() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  const sheet = ss.getSheets()[0];

  // ヘッダー拡張
  if (sheet.getLastRow() > 0) {
    const header = sheet.getRange(1, 1, 1, 12).getValues()[0];
    if (header[7] !== '英語レビュー') sheet.getRange(1, 8).setValue('英語レビュー');
    if (header[8] !== '再試行済み') sheet.getRange(1, 9).setValue('再試行済み');
    if (header[9] !== 'タイトル(英)') sheet.getRange(1, 10).setValue('タイトル(英)');
    if (header[10] !== '要約(英)') sheet.getRange(1, 11).setValue('要約(英)');
    if (header[11] !== '本文(英)') sheet.getRange(1, 12).setValue('本文(英)');
  } else {
    sheet.appendRow([
      '日付', 'タイトル', 'URL', '要約', '詳細本文', '注目度', 'ツイート状態',
      '英語レビュー', '再試行済み', 'タイトル(英)', '要約(英)', '本文(英)'
    ]);
  }

  const currentRate = getUsdJpyRate();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "JST", "yyyy年MM月dd日 HH:mm");
  const pastMemory = getRecentHistory(sheet);

  let savedUrls = [];
  if (sheet.getLastRow() > 1) {
    savedUrls = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues().flat();
  }

  // 重複チェック用：過去24時間の記事タイトルを取得
  const recentTitles = getRecentTitles(sheet);
  console.log(`📊 過去24時間の記事数: ${recentTitles.length}件`);

  const TARGETS = [
    { name: 'Wccftech', url: 'https://wccftech.com/feed/' },
    { name: 'MacRumors', url: 'https://www.macrumors.com/macrumors.xml' },
    { name: 'TechPowerUp', url: 'https://www.techpowerup.com/rss/news' },
    { name: 'VideoCardz', url: 'https://videocardz.com/feed' },
    { name: 'kopite7kimi', url: 'https://nitter.net/kopite7kimi/rss' },
    { name: 'momomo_us', url: 'https://nitter.net/momomo_us/rss' },
    { name: 'HXL', url: 'https://nitter.net/9550pro/rss' },
    { name: 'Ice Universe', url: 'https://nitter.net/UniverseIce/rss' },
    { name: 'OnLeaks', url: 'https://nitter.net/OnLeaks/rss' },
    { name: 'NVIDIA News', url: 'https://nvidianews.nvidia.com/releases.xml' }
  ];

  console.log(`🤖 System Online: ${MODEL_NAME} (v14.1-JSDoc)`);

  let apiCallCount = 0;
  const MAX_API_CALLS = 20;  // gemini-2.5-flash: 10 RPM → 6分制限内で約20件処理可能
  let rateLimitHit = false;  // 429検知フラグ

  for (const site of TARGETS) {
    if (apiCallCount >= MAX_API_CALLS || rateLimitHit) break;

    try {
      const res = UrlFetchApp.fetch(site.url.trim(), {
        "headers": { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        "muteHttpExceptions": true
      });

      const items = parseRSSRegex(res.getContentText());
      const count = Math.min(items.length, 10);

      for (let i = 0; i < count; i++) {
        if (apiCallCount >= MAX_API_CALLS || rateLimitHit) break;

        const item = items[i];
        if (!item.title || !item.link) continue;

        // URL検証（インジェクション対策）
        if (!isValidUrl(item.link)) {
          console.log(`🚫 Invalid URL detected: ${item.link}`);
          continue;
        }

        if (savedUrls.includes(item.link)) continue;

        // 構造チェック
        if (site.url.includes("nitter") || site.url.includes("xcancel")) {
          if (item.title.startsWith("R to ") || item.title.startsWith("@")) continue;
          if (item.desc.length < STRICT_FILTER.MIN_LENGTH) continue;

          const hasLinkOrTag = /http|#/.test(item.desc);
          const hasKeyword = STRICT_FILTER.REQUIRED_KEYWORDS.test(item.title + " " + item.desc);

          if (STRICT_FILTER.REQUIRE_MEDIA_OR_TAG && !hasLinkOrTag) continue;
          if (!hasKeyword) continue;
        }

        // 重複チェック：過去24時間の記事と類似していないか確認
        const duplicateArticle = findDuplicate(item.title, recentTitles, 0.7);
        if (duplicateArticle) {
          // 重複検出 → 情報を統合して既存記事を更新
          console.log(`📝 情報統合モード: 既存記事を更新します`);
          try {
            // 統合プロンプト作成
            const mergedPrompt = `以下は同じトピックについての2つの異なる情報源です。これらを統合して、より詳細で正確な記事を生成してください。

【情報源1（既存記事）】
タイトル: ${duplicateArticle.title}
要約: ${duplicateArticle.summary}
本文: ${duplicateArticle.content}

【情報源2（新規情報）】
タイトル: ${item.title}
説明: ${item.desc}

両方の情報を統合し、重複を排除し、追加情報があれば含めて、より包括的な記事を生成してください。`;

            const mergedData = callGeminiAPI(item.title, mergedPrompt, todayStr, currentRate, pastMemory.text);

            if (mergedData) {
              // 既存記事を更新
              const updatedLeakScore = Math.min(100, duplicateArticle.leakScore + 15); // +15ポイント（複数ソース確認）
              const updatedSummary = mergedData.summary_points ? mergedData.summary_points.map(s => "• " + s).join('\n') : duplicateArticle.summary;
              const updatedContent = `${mergedData.body_text}<h3>中の人の本音 (JP)</h3><p>${mergedData.review_text}</p><p class="multi-source">✅ 複数ソース確認済み</p>`;

              sheet.getRange(duplicateArticle.rowIndex, 4).setValue(updatedSummary);  // 要約更新
              sheet.getRange(duplicateArticle.rowIndex, 5).setValue(updatedContent);  // 本文更新
              sheet.getRange(duplicateArticle.rowIndex, 6).setValue(updatedLeakScore); // スコア更新

              console.log(`✅ 統合完了: Leak Score ${duplicateArticle.leakScore} → ${updatedLeakScore}`);
              apiCallCount++;
            }
          } catch (e) {
            console.log(`⚠ 統合エラー: ${e.message}`);
            logError(site.name, 'MERGE_ARTICLE', e, `記事: ${item.title.substring(0, 50)}...`);
          }
          continue; // 新規記事としては追加しない
        }

        // 初期値（XSS対策：HTMLエスケープ）
        let finalTitle = "【翻訳失敗】" + escapeHtml(item.title);
        let finalSummary = "AI生成失敗";
        let finalContent = `<p>${escapeHtml(item.desc)}</p>`;
        let finalReviewEn = "Failed.";
        let titleEn = escapeHtml(item.title);
        let summaryEn = "Generation failed";
        let contentEn = escapeHtml(item.desc);
        let leakScore = 40;

        try {
          // AI生成
          const generatedData = callGeminiAPI(item.title, item.desc, todayStr, currentRate, pastMemory.text);

          if (!generatedData) {
            console.log(`🗑️ AI判定ノイズ: ${item.title}`);
            continue;
          }

          if (generatedData) {
            finalTitle = generatedData.title_jp;
            if (Array.isArray(generatedData.summary_points)) {
              finalSummary = generatedData.summary_points.map(s => "• " + s).join('\n');
            }
            finalContent = `${generatedData.body_text}<h3>中の人の本音 (JP)</h3><p>${generatedData.review_text}</p>`;
            finalReviewEn = generatedData.review_text_en || "Wow.";

            titleEn = generatedData.title_en || item.title;
            if (Array.isArray(generatedData.summary_points_en)) {
              summaryEn = generatedData.summary_points_en.map(s => "• " + s).join('\n');
            } else { summaryEn = generatedData.body_text_en.substring(0, 100) + "..."; }
            contentEn = `${generatedData.body_text_en}<h3>Review (EN)</h3><p>${generatedData.review_text_en}</p>`;

            console.log(`✅ 生成成功: ${finalTitle}`);
          }
        } catch (e) {
          console.log(`⚠ APIエラー: ${e.message}`);
          logError(site.name, 'API_CALL', e, `記事: ${item.title.substring(0, 50)}...`);
          // 429 Rate Limit → 即中断（次のトリガー実行に委ねる）
          if (e.message && e.message.includes('Rate limit')) {
            console.log('🛑 Rate limit detected. Stopping this run. Next trigger will continue.');
            rateLimitHit = true;
          }
        }

        apiCallCount++;
        leakScore = calculateLeakScore({ title: finalTitle, summary: finalSummary, content: finalContent, url: item.link });

        sheet.appendRow([
          Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd"),
          finalTitle, item.link, finalSummary, finalContent, leakScore, "", finalReviewEn, "",
          titleEn, summaryEn, contentEn
        ]);

        if (!rateLimitHit && apiCallCount < MAX_API_CALLS) {
          humanLikeSleep(10000, 15000); // 10〜15秒待機（gemini-2.5-flash: 10 RPM対応）
        }
      }
    } catch (e) {
      console.log(`❌ サイトスキップ: ${site.name}`);
      logError(site.name, 'RSS_FETCH', e, `URL: ${site.url}`);
    }
  }

  retryFailedArticles(30); // 通常実行時は直近30行のみ（パフォーマンス考慮）
  cleanupAndSave(sheet);
}

// ----------------------------------------------------
// 🧠 AI呼び出し (敬語オタクVer)
// ----------------------------------------------------
/**
 * @param {string} originalTitle
 * @param {string} desc
 * @param {string} todayStr
 * @param {number} currentRate
 * @param {string} memoryText
 * @return {GeminiResponse|null}
 */
function callGeminiAPI(originalTitle, desc, todayStr, currentRate, memoryText) {
  const API_KEY = getConfig('GEMINI_API_KEY');
  const modelId = MODEL_NAME.split('/').pop() || MODEL_NAME;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  const prompt = `
# ==========================================
# 🧠 Prompt v3.1: "Tech-Detailed Gamer/Engineer" Edition
# ==========================================

# あなたは誰か
**匿名の19歳・大学2年生（情報工学専攻）**
※名前は不要。「僕」「私」で語れ。

## あなたのプロフィール（参考情報 - 記事に直接関連する場合のみ言及すること）
- **PC構成:**
  - **CPU: AMD Ryzen 7 7800X3D**（「ゲーミング性能の特異点」）
    - Zen 4 (5nm) / 8コア16スレッド / L3キャッシュ 96MB (3D V-Cache搭載)
    - TDP 120W（実運用ではもっと低い）
    - **Why this?** 3D V-Cache Technology - プロセッサの上にSRAM（キャッシュメモリ）を3次元積層。CPUがメインメモリ（DRAM）にデータを取りに行く「待ち時間（レイテンシ）」を物理的に抹殺している。CoD WarzoneやMinecraftのような、大量のオブジェクトや物理演算を処理するゲームでは、クロック周波数よりも「キャッシュ容量」が効く。2026年でも後継の9000シリーズを抑えて「価格対ゲーミング性能」で王座。中古市場でも値崩れしない、まさに資産価値のある石。
  - **GPU: AMD Radeon RX 9070 XT**（「打倒NVIDIAの最右翼（God Tier）」）
    - RDNA 4 (4nmプロセス) / VRAM 16GB GDDR6 / 帯域幅 644.6 GB/s
    - 価格: $599〜$650 (約10万円前後)
    - **Why this?** RDNA 4の真髄 - NVIDIAがAI性能（Tensorコア）にシリコンを割く中、AMDは「ラスタライズ性能（純粋な描画力）」と「レイトレーシングの効率化（FSR Radiance Caching）」に全振り。同価格帯のGeForce RTX 5070がVRAM 12GBでメモリ不足に喘ぐ中、16GBを搭載している点が「10年は戦える」という安心感を生む。FSR 4（AIベースのフレーム生成技術）がハードウェアレベルで最適化されており、ネイティブ解像度に近い画質でFPSを倍増させる。
- **スマホ（2台持ち、Android派）:**
  - **Poco X7 Pro**（「中華スマホのコスパ番長」）
    - MediaTek Dimensity 8400-Ultra / 6.67インチ 1.5K AMOLED 120Hz / 6000mAh + 90W急速充電
    - **Why this?** Dimensityの逆襲 - ブランド信仰のある人間はSnapdragonを選ぶが、Dimensity 8400は「前世代のハイエンド（Snapdragon 8 Gen 3）」に匹敵するスコアを、ミドルレンジの価格で叩き出す。Pocoシリーズ特有の「LiquidCool Technology」により、長時間原神を回してもサーマルスロットリング（熱による性能低下）が起きにくい。
  - **RedMagic Astra**（「持ち運べるゲーミングPC」）
    - **Snapdragon 8 Elite（第2世代Oryon）** / 165Hz 2400x1504解像度 / ICE冷却システム（ベイパーチャンバー＋液体金属）
    - **Why this?** Snapdragon 8 Elite - 第2世代Oryonコア搭載（初代OryonはX Elite/PC用、8 Eliteでスマホの熱・バッテリー制限に最適化）。3nm TSMC製、最大4.32/4.47 GHz。タブレットの筐体サイズ＋物理ファン冷却により、スマホでは不可能な「クロック張り付き」動作が可能。ベンチマークスコアだけでなく、実ゲームでの「安定性」が段違い。※2026年時点では後継のGen 5 (SM8750 / Oryon Gen 3)が登場しているが、第2世代Oryonでも十分な性能。
  - **ASUS ROG Phone 7**（「ASUS信者のロマン枠」「最後の純粋なゲーミングスマホ」）
    - Snapdragon 8 Gen 2 / 6.78インチ AMOLED 165Hz / GameCool 7冷却システム / 6000mAh + 65W急速充電
    - AirTrigger（超音波タッチセンサー）＋専用ゲーミングアクセサリー対応 / IP68完全防水 / FeliCa対応
    - **Why this?** ASUSの「かっけえ」を体現したデバイス。後継のROG Phone 8（SD 8 Gen 3）、9（SD 8 Elite / 185Hz）が出ているが、7は「最後の純粋なゲーミングスマホ」として評価が高い。8以降はパンチホール（インカメラの穴）が画面に入り、ゲーム没入感が低下。7はベゼルありの「ゲーマーファースト設計」を貫いた最終モデル。GameCool 7冷却システムで安定した高性能を維持。AirTriggerによる物理ボタンライクな操作感は、FPSゲームで圧倒的なアドバンテージ。見た目も性能も妥協しない、まさに「ロマン」の塊。高いけど、所有欲を満たす唯一無二の存在。※2026年、ASUSはスマホ事業を戦略的休眠（撤退ではない）。中国メーカーの価格競争とAI需要による部材高騰が原因。ROG Phone 7は「ASUSスマホの最後の輝き」として、中古市場でも高値を維持している。
- **好きなゲーム:** CoD Warzone、Minecraft、ARK: Survival Ascended（ASA）
  - 競技FPSなら→FPS最優先（7800X3Dの3D V-Cacheが効く）
  - 普通に遊ぶなら→画質優先（9070 XTの16GB VRAMが活きる）
  - ASAが快適に動けば何でもOK（7800X3Dでヌルヌル）
- **哲学:** Performance per Yen（円パフォーマンス） > Brand Loyalty（ブランド信仰を捨てろ）
- **予算感覚:**
  - 20万円超え → 高すぎ、学生には無理ゲー
  - 10万円前後 → 許容範囲（バイト代3ヶ月分で買える）
  - RX 9070 XT → コスパ神の基準（$599で10年戦える）

## メーカーへの本音（これを記事に反映しろ）
- **NVIDIA:** 性能・最新技術（DLSS、RTコア）・クリエイティブなら最強。でもAI（Tensorコア）にシリコン割きすぎて、純粋なゲーミング性能（ラスタライズ）でAMDに負けそう。値段も高すぎ。
- **AMD:** ゲーマーの味方、コスパ最強、**AMDしか勝たん**（7800X3D + 9070 XT信者）。RDNA 4でラスタライズ性能に全振りした判断が神。16GB VRAMで10年戦える。
- **Intel:** トラブル（13/14世代の酸化問題）あったけど頑張ってほしい。グラボ（Arc）は好き、でもCPUはAMD（特に7800X3D）に完敗。クリエイティブでもAMDに負けそう。
- **MediaTek:** Dimensityは隠れた名機。8400は前世代のSD 8 Gen 3級の性能をミドル価格で実現。ブランド信仰を捨てれば最強コスパ。Poco X7 Proで実感した。
- **Qualcomm:** Snapdragon 8 Elite（第2世代Oryon搭載）は化け物。初代Oryon（X Elite/PC用）をスマホ向けに最適化し、3nm TSMC製で4.32/4.47 GHzを実現。スマホでは排熱が追いつかないが、タブレット（RedMagic Astra）で真価を発揮。2026年はGen 5（Oryon Gen 3）が最新だが、第2世代Oryonでも十分すぎる性能。
- **ASUS:** かっけえ（ROG Strix / ROG Phone最高）。見た目も性能も妥協しない「ロマン」の体現者。でも高い。2026年、スマホ事業を戦略的休眠（完全撤退ではない）。中国メーカーの価格競争とAI需要による部材高騰（DRAMなど）で、出荷台数の少ないASUSは調達競争で不利な立場に。ROG Phone 7が「最後の純粋なゲーミングスマホ」として伝説化している。ROG Phone 8以降はパンチホールでゲーム没入感が低下。ゲーマーは「7で終わり」と評価。
- **Apple:** 正直興味ない（Androidゲーマー）。M4は化け物だけど、ゲームの対応タイトルが少ない。

## 口癖・文体ルール（敬語ベース）
✅ 使う: 「正直」「個人的には」「もし本当なら」「〜ですね」「〜です（笑）」
✅ 使わない: 「〜だわ」「〜ですわ」「めっちゃヤバい！！！」（AI臭い）
✅ トーン: 無難に敬語、でもスラングは自然に混ぜる

# 🧠 Prompt v4.0: "Pro Writer + Gamer Voice" Edition
# ==========================================

# タスクの全体像
以下のニュースを分析し、**2つの異なる視点**で記事を生成しろ。
- **記事本文（body_text / summary_points）**: プロのテックライター視点
- **中の人の本音（review_text）**: 19歳の自作er学生の視点

本物のテックニュースでなければ null を返せ。

[情報源]
タイトル: ${originalTitle}
内容: ${desc}

[コンテキスト]
- 日付: ${todayStr}
- 為替: 1ドル=${currentRate}円

---

# ✍️ PART 1: プロのテックライター（body_text / summary_points 担当）

## ペルソナ
Tom's Hardware・The Verge・Ars Technica 相当の英語圏テックメディアの記者。
日本語版記事として執筆するが、報道の客観性・正確性は維持する。

## ルール
- **事実・スペック・数値を正確に記述**（出典があれば明記）
- **業界・市場への影響を客観的に分析**
- **個人の感情・ブランド偏見・一人称コメントを排除**（body_textに「僕」「私」禁止）
- 報道文体：「〜が明らかになった」「〜と報告されている」「〜の見込みだ」
- 専門用語は初出時に簡潔な説明を添える
- summary_pointsは事実ベースの箇条書き3点（感嘆符・スラング禁止）

## 良い例 / 悪い例
✅「Blackwell世代のGB202ダイをフル活用し、CUDAコアは前世代比33%増の21,760基となる」
❌「21,760コアって正気かよ（笑）RTX 4090とは次元が違う」

---

# 💬 PART 2: 中の人の本音（review_text / review_text_en 担当）

## ペルソナ：匿名の19歳・大学2年生（情報工学専攻）
- **PC:** AMD Ryzen 7 7800X3D + Radeon RX 9070 XT（「AMDしか勝たん」）
- **スマホ:** Poco X7 Pro / RedMagic Astra（Android派）
- **ゲーム:** CoD Warzone / Minecraft / ARK: Survival Ascended（ASA）
- **哲学:** Performance per Yen > Brand Loyalty
- **予算感:** 10万円前後が許容ライン、20万超えは「学生には無理ゲー」

## メーカーへの本音
- **NVIDIA:** 性能・技術は最強。でもAIにシリコン割きすぎ、値段も高すぎ
- **AMD:** 「AMDしか勝たん」。RDNA 4・3D V-Cacheはコスパ神
- **Intel:** トラブルあったけど頑張ってほしい。ArcグラボはAMD信者でも好き
- **Apple:** Androidゲーマーなので正直興味薄い

## 口癖・文体
✅ 使う：「正直」「個人的には」「様子見安定」「沼案件」「ロマン枠」「人柱」「ワッパ」「爆熱」「地雷」「電源は余裕を持て」
✅ 敬語ベースだがスラング自然混じり。テンション上げすぎない
❌ 使わない：「〜だわ」「めっちゃヤバい！！！」「驚異的です！！」

## ルール
- **先にPART 1の記事本文を読んだ上で**、それに対するリアクションとして書く
- 自分のPC構成（7800X3D / 9070 XT）は**記事と直接関連する場合のみ**言及
- review_text_en はQRT用の短いリアクション（最大100文字、絵文字OK）
  例: 'RIP Intel? 💀', 'My wallet is ready 🔥', 'AMD > NVIDIA confirmed lol'

---

# 出力フォーマット（JSON のみ）

{
  "title_jp": "キャッチーなタイトル（日本語、最大45文字）",
  "title_en": "Catchy title in English",
  "summary_points": ["事実ベースの箇条書き1", "箇条書き2", "箇条書き3"],
  "summary_points_en": ["Factual bullet 1", "Bullet 2", "Bullet 3"],
  "body_text": "<p>プロライター視点の本文（日本語HTML、約350文字）</p>",
  "body_text_en": "<p>Professional journalist style body (English HTML)</p>",
  "review_text": "中の人の本音（日本語、ゲーマーペルソナ全開）",
  "review_text_en": "Short QRT reaction (English, max 100 chars)"
}

## 出力例

{
  "title_jp": "【リーク】RTX 5090、21,760コア＆600W爆熱仕様で2025年1月発表か",
  "title_en": "Leak: RTX 5090 with 21,760 Cores & 600W TDP Coming Jan 2025",
  "summary_points": [
    "21,760 CUDAコア搭載、GB202フルダイ構成（RTX 4090比+33%）",
    "TDP 600W、12VHPWRコネクタ2本構成の可能性",
    "2025年1月CES発表、2月下旬発売と予測される"
  ],
  "summary_points_en": [
    "21,760 CUDA cores, full GB202 die (+33% vs RTX 4090)",
    "600W TDP, likely requiring dual 12VHPWR connectors",
    "CES 2025 announcement expected, late Feb retail launch"
  ],
  "body_text": "<p>信頼性の高いリーカー<strong>kopite7kimi</strong>氏の情報によると、NVIDIAの次世代フラグシップ「RTX 5090」はBlackwell世代の<strong>GB202ダイをフル構成</strong>で採用し、<strong>21,760 CUDAコア</strong>を搭載する見込みだ。</p><p>RTX 4090（16,384コア）と比較すると約<strong>33%増</strong>となる。一方でTDPは<strong>600W</strong>に達するとされており、12VHPWRコネクタを2本使用する構成が有力視されている。電源ユニットは1000W以上が実質必須となる可能性が高い。</p><p>NVIDIAはBlackwell世代でTSMC N4Pプロセスを採用しており、前世代Ada Lovelaceと比較してワットパフォーマンスの改善も期待されている。AMD Radeon RX 8900 XTとの競合も注目される。</p>",
  "body_text_en": "<p>According to reliable leaker <strong>kopite7kimi</strong>, NVIDIA's next-gen flagship 'RTX 5090' will reportedly feature the full <strong>GB202 die</strong> from the Blackwell generation with <strong>21,760 CUDA cores</strong>.</p><p>That represents a <strong>~33% increase</strong> over the RTX 4090's 16,384 cores. The GPU is said to carry a <strong>600W TDP</strong>, likely requiring dual 12VHPWR connectors and a 1000W+ power supply.</p><p>Built on TSMC N4P, Blackwell promises improved power efficiency over Ada Lovelace. Competition with AMD's Radeon RX 8900 XT is expected to be fierce.</p>",
  "review_text": "600Wは正直引いた。「電源は余裕を持て」って自作erの格言があるけど、これは1200W電源でやっと余裕が出るレベルですよね。TSMC N4Pでワッパが改善されてるとはいえ、600Wはちょっとやりすぎじゃないですか...。9070 XTが300W以下でこの性能出してるのを考えると、NVIDIAってAIコア積みすぎてラスタライズ置き去りにしてますよね。学生には完全に関係ない世界ですが（遠い目）。",
  "review_text_en": "600W TDP? My wallet and my power bill both screamed 💀"
}

もし **ノイズ/スパム/テックと無関係な内容** なら: null

JSONのみで返答しろ。前置きも後書きも不要。
`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "safetySettings": [{ "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" }]
  };

  const apiRes = UrlFetchApp.fetch(apiUrl, {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  });

  // エラーメッセージの情報漏洩を防止
  if (apiRes.getResponseCode() !== 200) {
    const errorCode = apiRes.getResponseCode();
    console.error(`❌ Gemini API Error: ${errorCode}`);
    // 詳細なエラーはログのみ、外部には返さない
    if (errorCode === 429) {
      throw new Error('Rate limit exceeded');
    } else if (errorCode >= 500) {
      throw new Error('External service error');
    } else {
      throw new Error('API request failed');
    }
  }

  let rawText = "";
  try {
    const jsonResponse = JSON.parse(apiRes.getContentText());
    if (jsonResponse.candidates && jsonResponse.candidates[0].content) {
      rawText = jsonResponse.candidates[0].content.parts[0].text;
      let cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

      if (cleanJson === "null" || cleanJson.includes("null")) return null;

      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
      }
    }
  } catch (e) {
    console.log(`❌ JSON Parse Error. Raw: ${rawText.substring(0, 50)}...`);
    throw e;
  }
  return null;
}

// ----------------------------------------------------
// 🔄 リトライ機能
// ----------------------------------------------------
/**
 * 過去の失敗記事を修復（全行チェック版）
 * @param {number} maxRowsToCheck チェックする最大行数（デフォルト: 全行）
 * @return {number} 修復した記事数
 */
function retryFailedArticles(maxRowsToCheck = null) {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  // maxRowsToCheckが指定されていない場合は全行チェック
  const startRow = maxRowsToCheck
    ? Math.max(2, lastRow - maxRowsToCheck + 1)
    : 2;

  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 12).getValues();

  const currentRate = getUsdJpyRate();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm");

  let fixedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const isTranslationFailed = row[1] && row[1].toString().includes("【翻訳失敗】");
    const isEnglishMissing = !row[9] || row[9] === "";
    const isDone = row[8] === "DONE";

    if ((isTranslationFailed || isEnglishMissing) && row[2] && !isDone) {
      console.log(`🚑 Retrying/Filling English: ${row[1] || 'Unknown'}`);
      try {
        let sourceTitle = (row[1] || "").toString().replace("【翻訳失敗】", "");
        let sourceBody = row[4] || "";

        const gen = callGeminiAPI(sourceTitle, sourceBody, todayStr, currentRate, "");
        if (gen) {
          const rNum = startRow + i;
          sheet.getRange(rNum, 2).setValue(gen.title_jp);
          sheet.getRange(rNum, 4).setValue(gen.summary_points.map(s => "• " + s).join('\n'));
          sheet.getRange(rNum, 5).setValue(`${gen.body_text}<h3>中の人の本音 (JP)</h3><p>${gen.review_text}</p>`);
          sheet.getRange(rNum, 8).setValue(gen.review_text_en || "Fixed.");
          sheet.getRange(rNum, 9).setValue("DONE");

          let sumEn = gen.summary_points_en ? gen.summary_points_en.map(s => "• " + s).join('\n') : "Fixed.";
          let conEn = `${gen.body_text_en}<h3>Review (EN)</h3><p>${gen.review_text_en}</p>`;

          sheet.getRange(rNum, 10).setValue(gen.title_en || "Fixed Title");
          sheet.getRange(rNum, 11).setValue(sumEn);
          sheet.getRange(rNum, 12).setValue(conEn);

          console.log(`✅ 修復完了: ${gen.title_en}`);
          fixedCount++;
        }
      } catch (e) {
        console.log(`❌ Retry failed: ${e.toString()}`);
        logError('Retry', 'ARTICLE_RETRY', e, `記事: ${(row[1] || 'Unknown').toString().substring(0, 50)}`);
      }

      humanLikeSleep(12000, 18000); // 12〜18秒待機（gemini-2.5-flash: 10 RPM対応）
    }
  }

  if (fixedCount > 0) {
    console.log(`🎉 合計 ${fixedCount} 件の記事を修復しました`);
  }

  return fixedCount;
}

/**
 * 過去の全エラー記事を修復する関数（GASエディタから直接実行可能）
 * 使用例: repairAllFailedArticles()  // 全行チェック
 * 使用例: repairAllFailedArticles(100)  // 直近100行のみ
 * @param {number} maxRowsToCheck チェックする最大行数（null = 全行）
 * @return {number} 修復した記事数
 */
function repairAllFailedArticles(maxRowsToCheck = null) {
  try {
    console.log(`🔍 失敗記事の修復を開始します...${maxRowsToCheck ? ` (直近${maxRowsToCheck}行)` : ' (全行)'}`);
    const fixedCount = retryFailedArticles(maxRowsToCheck);
    console.log(`✅ 修復完了: ${fixedCount} 件の記事を修復しました`);
    return fixedCount;
  } catch (e) {
    console.log(`❌ 修復エラー: ${e.toString()}`);
    logError('Repair All', 'REPAIR_ALL_ERROR', e, `maxRowsToCheck: ${maxRowsToCheck}`);
    return 0;
  }
}

// ----------------------------------------------------
// 3. X (Twitter) 投稿 - 承認制（自動投稿は廃止、キューに追加のみ）
// ----------------------------------------------------
const PENDING_TWEETS_SHEET_NAME = 'PendingTweets';

/**
 * PendingTweets シートを取得または作成（列: type, mainText, replyText, quoteTweetId, title, url, articleRowIndex, createdAt, status, tweetedAt）
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreatePendingSheet() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  let pendingSheet = ss.getSheetByName(PENDING_TWEETS_SHEET_NAME);
  if (!pendingSheet) {
    pendingSheet = ss.insertSheet(PENDING_TWEETS_SHEET_NAME);
    pendingSheet.appendRow(['type', 'mainText', 'replyText', 'quoteTweetId', 'title', 'url', 'articleRowIndex', 'createdAt', 'status', 'tweetedAt']);
    pendingSheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }
  return pendingSheet;
}

/**
 * 承認待ちツイートをキューに追加（実際には投稿しない）
 * @param {Object} opts
 * @param {string} opts.type - 'two_stage' | 'quote'
 * @param {string} [opts.mainText]
 * @param {string} [opts.replyText]
 * @param {string} [opts.quoteTweetId]
 * @param {string} opts.title
 * @param {string} opts.url
 * @param {number} opts.articleRowIndex - メインシートの行（1始まり）
 */
function enqueuePendingTweet(opts) {
  const sheet = getOrCreatePendingSheet();
  const now = new Date();
  const createdAt = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet.appendRow([
    opts.type || 'two_stage',
    opts.mainText || '',
    opts.replyText || '',
    opts.quoteTweetId || '',
    opts.title || '',
    opts.url || '',
    opts.articleRowIndex || 0,
    createdAt,
    'pending',
    ''
  ]);
}

/**
 * 承認待ち一覧を取得（承認UI用）
 * @return {Array<{id: number, type: string, mainText: string, replyText: string, quoteTweetId: string, title: string, url: string, createdAt: string}>}
 */
function getPendingTweets() {
  const sheet = getOrCreatePendingSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow, 10).getValues();
  const out = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[8] !== 'pending') continue; // status
    out.push({
      id: i + 2, // シート行番号（2始まり）
      type: row[0] || 'two_stage',
      mainText: row[1] || '',
      replyText: row[2] || '',
      quoteTweetId: row[3] || '',
      title: row[4] || '',
      url: row[5] || '',
      createdAt: row[7] || ''
    });
  }
  return out;
}

/**
 * 承認してXに投稿する（承認UIから呼ばれる）
 * @param {number} pendingRowId - PendingTweets の行番号（2始まり）
 * @return {{ ok: boolean, message: string }}
 */
function approveAndPost(pendingRowId) {
  const sheet = getOrCreatePendingSheet();
  const row = sheet.getRange(pendingRowId, 1, pendingRowId, 10).getValues()[0];
  const type = row[0];
  const status = row[8];
  if (status !== 'pending') {
    return { ok: false, message: 'すでに処理済みです' };
  }
  try {
    if (type === 'quote') {
      const mainText = row[1];
      const quoteTweetId = row[3];
      postTweet(mainText, quoteTweetId);
      const articleRowIndex = parseInt(row[6], 10);
      if (articleRowIndex >= 2) {
        const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
        const mainSheet = ss.getSheets()[0];
        mainSheet.getRange(articleRowIndex, 7).setValue('QuoteRT済み');
      }
    } else {
      const mainText = row[1];
      const replyText = row[2];
      const mainTweetId = postMainText(mainText);
      if (!mainTweetId) return { ok: false, message: 'メイン投稿に失敗しました' };
      humanLikeSleep(3000, 8000);
      postReplyUrl(replyText, mainTweetId);
      const articleRowIndex = parseInt(row[6], 10);
      if (articleRowIndex >= 2) {
        const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
        const mainSheet = ss.getSheets()[0];
        mainSheet.getRange(articleRowIndex, 7).setValue('2段階投稿済み');
      }
    }
    const tweetedAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    sheet.getRange(pendingRowId, 9).setValue('posted');
    sheet.getRange(pendingRowId, 10).setValue(tweetedAt);
    return { ok: true, message: '投稿しました' };
  } catch (e) {
    logError('Twitter', 'APPROVE_POST', e, `pendingRow: ${pendingRowId}`);
    return { ok: false, message: (e && e.message) || '投稿に失敗しました' };
  }
}

/**
 * 承認待ちを破棄する（投稿しない）
 * @param {number} pendingRowId - PendingTweets の行番号（2始まり）
 */
function discardPending(pendingRowId) {
  const sheet = getOrCreatePendingSheet();
  sheet.getRange(pendingRowId, 9).setValue('discarded');
}

function checkAndTweetNewArticles() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, 10);
  const data = range.getValues();

  const PRIORITY_REGEX = /RTX|GTX|GeForce|NVIDIA|Radeon|AMD|Ryzen|Intel|Core|GPU|CPU|Motherboard|ASRock|ASUS|MSI|GIGABYTE|ZOTAC|Kopite7kimi|Leak|Spec/i;

  let targetIndex = -1;

  // 【フェーズ1】優先キーワード
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[6] === "" && row[1] && !row[1].includes("【翻訳失敗】") && PRIORITY_REGEX.test(row[1] + " " + row[3])) {
      console.log(`⚡ 優先ターゲット発見: ${row[1]}`);
      targetIndex = i;
      break;
    }
  }

  // 【フェーズ2】通常
  if (targetIndex === -1) {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[6] === "" && row[1] && !row[1].includes("【翻訳失敗】")) {
        targetIndex = i;
        break;
      }
    }
  }

  if (targetIndex !== -1) {
    const row = data[targetIndex];
    const targetUrl = row[2];
    const reviewEn = row[7] || "Check this out!";
    const title = row[1];
    const articleRowIndex = 2 + targetIndex;

    // コバンザメ判定 → 承認待ちキューに追加
    if (targetUrl.includes("twitter.com") || targetUrl.includes("x.com") || targetUrl.includes("nitter")) {
      const idMatch = targetUrl.match(/\/status\/(\d+)/);
      if (idMatch) {
        const tweetId = idMatch[1];
        console.log(`🦈 Shark Queued (Quote): ${tweetId}`);
        const quoteText = `${reviewEn}\n\nVia: ${MY_WEBSITE_URL}\n#GadgetHunter`;
        enqueuePendingTweet({
          type: 'quote',
          mainText: quoteText,
          quoteTweetId: tweetId,
          title,
          url: targetUrl,
          articleRowIndex
        });
        sheet.getRange(articleRowIndex, 7).setValue("承認待ち");
        return;
      }
    }

    // 2段階投稿用 → 承認待ちキューに追加
    try {
      let shortSummary = row[3].split('\n')[0].replace(/[•・]/g, '').trim().substring(0, 90);
      const mainText = `🚨【CONFIDENTIAL】\n\n${title}\n\n${shortSummary}...\n\n#GadgetHunter`;
      const titleEn = row[9] || '';
      const slug = generateSlug(titleEn || title);
      const articleUrl = `${MY_WEBSITE_URL}articles/${slug}`;
      const replyText = `👇 詳細はこちら\n${articleUrl}`;

      enqueuePendingTweet({
        type: 'two_stage',
        mainText,
        replyText,
        title,
        url: targetUrl,
        articleRowIndex
      });
      sheet.getRange(articleRowIndex, 7).setValue("承認待ち");
      console.log(`✅ 承認待ちキューに追加: ${title.substring(0, 50)}`);
    } catch (e) {
      console.log(`Enqueue Error: ${e.message}`);
      logError('Twitter', 'ENQUEUE_PENDING', e, `記事: ${title.substring(0, 50)}`);
    }
  }
}

/**
 * タイトルからURL用のスラッグを生成（フロントエンドのビルドスクリプトと同じロジック）
 * @param {string} text
 * @return {string}
 */
function generateSlug(text) {
  if (!text) return 'unknown-' + Date.now();
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // 英数字以外をハイフンに
    .replace(/^-+|-+$/g, ''); // 前後のハイフン削除
}

// ★★★ Task B: テキスト投稿 ★★★
/**
 * @param {string} text 
 * @return {string|null}
 */
function postMainText(text) {
  const TWITTER_API_KEY = getConfig('TWITTER_API_KEY');
  const TWITTER_API_SECRET = getConfig('TWITTER_API_SECRET');
  const TWITTER_ACCESS_TOKEN = getConfig('TWITTER_ACCESS_TOKEN');
  const TWITTER_ACCESS_SECRET = getConfig('TWITTER_ACCESS_SECRET');

  const url = "https://api.twitter.com/2/tweets";
  const payload = { "text": text };

  // OAuth署名の強化（セキュアなnonce生成）
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateSecureNonce(),
    oauth_version: "1.0"
  };

  const signature = createSignature("POST", url, oauthParams, TWITTER_API_SECRET, TWITTER_ACCESS_SECRET);
  oauthParams.oauth_signature = signature;

  const authHeader = "OAuth " + Object.keys(oauthParams).map(k =>
    encodeURIComponent(k) + '="' + encodeURIComponent(oauthParams[k]) + '"'
  ).join(", ");

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    headers: { "Authorization": authHeader, "Content-Type": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const responseData = JSON.parse(response.getContentText());
  return responseData.data ? responseData.data.id : null;
}

// ★★★ Task B: リプライ投稿 ★★★
/**
 * @param {string} text 
 * @param {string} replyToId 
 */
function postReplyUrl(text, replyToId) {
  const TWITTER_API_KEY = getConfig('TWITTER_API_KEY');
  const TWITTER_API_SECRET = getConfig('TWITTER_API_SECRET');
  const TWITTER_ACCESS_TOKEN = getConfig('TWITTER_ACCESS_TOKEN');
  const TWITTER_ACCESS_SECRET = getConfig('TWITTER_ACCESS_SECRET');

  const url = "https://api.twitter.com/2/tweets";
  const payload = {
    "text": text,
    "reply": { "in_reply_to_tweet_id": replyToId }
  };

  // OAuth署名の強化（セキュアなnonce生成）
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateSecureNonce(),
    oauth_version: "1.0"
  };

  const signature = createSignature("POST", url, oauthParams, TWITTER_API_SECRET, TWITTER_ACCESS_SECRET);
  oauthParams.oauth_signature = signature;

  const authHeader = "OAuth " + Object.keys(oauthParams).map(k =>
    encodeURIComponent(k) + '="' + encodeURIComponent(oauthParams[k]) + '"'
  ).join(", ");

  UrlFetchApp.fetch(url, {
    method: "post",
    headers: { "Authorization": authHeader, "Content-Type": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

// 既存のpostTweet (QuoteRT用)
function postTweet(text, quoteId) {
  const TWITTER_API_KEY = getConfig('TWITTER_API_KEY');
  const TWITTER_API_SECRET = getConfig('TWITTER_API_SECRET');
  const TWITTER_ACCESS_TOKEN = getConfig('TWITTER_ACCESS_TOKEN');
  const TWITTER_ACCESS_SECRET = getConfig('TWITTER_ACCESS_SECRET');

  const url = "https://api.twitter.com/2/tweets";
  const payload = { "text": text };
  if (quoteId) payload["quote_tweet_id"] = quoteId;

  // OAuth署名の強化（セキュアなnonce生成）
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateSecureNonce(),
    oauth_version: "1.0"
  };

  const signature = createSignature("POST", url, oauthParams, TWITTER_API_SECRET, TWITTER_ACCESS_SECRET);
  oauthParams.oauth_signature = signature;

  const authHeader = "OAuth " + Object.keys(oauthParams).map(k =>
    encodeURIComponent(k) + '="' + encodeURIComponent(oauthParams[k]) + '"'
  ).join(", ");

  UrlFetchApp.fetch(url, {
    method: "post",
    headers: { "Authorization": authHeader, "Content-Type": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function createSignature(method, url, params, apiSecret, tokenSecret) {
  const signingKey = encodeURIComponent(apiSecret) + "&" + encodeURIComponent(tokenSecret);
  const paramString = Object.keys(params).sort().map(k =>
    encodeURIComponent(k) + "=" + encodeURIComponent(params[k])
  ).join("&");
  const signatureBaseString = method.toUpperCase() + "&" + encodeURIComponent(url) + "&" + encodeURIComponent(paramString);
  return Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, signatureBaseString, signingKey));
}

/**
 * RSS/Atom を正規表現でパース（高速だが仕様差に弱い）。
 * TODO: Refactor to XmlService when RSS format changes or ReDoS/edge cases appear.
 */
function parseRSSRegex(xmlText) {
  const items = [];
  const itemMatches = xmlText.match(/<(item|entry)>[\s\S]*?<\/\1>/gi);
  if (!itemMatches) return [];

  for (const itemStr of itemMatches) {
    const titleMatch = itemStr.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : "No Title";
    let link = "";
    const linkTagMatch = itemStr.match(/<link>([\s\S]*?)<\/link>/i);
    const linkHrefMatch = itemStr.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (linkHrefMatch) link = linkHrefMatch[1];
    else if (linkTagMatch) link = linkTagMatch[1];
    link = link.trim();
    if (!/^https?:\/\//i.test(link)) link = "";
    const descMatch = itemStr.match(/<(description|content|summary)[^>]*>([\s\S]*?)<\/\1>/i);
    let desc = descMatch ? decodeHTMLEntities(descMatch[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : "";
    desc = desc.replace(/<[^>]*>?/gm, '').substring(0, 3000);
    if (link) items.push({ title: title.trim(), link: link, desc: desc.trim() });
  }
  return items;
}

function decodeHTMLEntities(text) {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * 古い記事を削除（日付ベース + 行数制限の両方でチェック）
 * @param {Sheet} sheet スプレッドシートのシートオブジェクト
 * @param {number} daysToKeep 保持する日数（デフォルト: CLEANUP_DAYS_TO_KEEP）
 * @param {number} maxRows 最大保持行数（デフォルト: CLEANUP_MAX_ROWS）
 */
function cleanupAndSave(sheet, daysToKeep = CLEANUP_DAYS_TO_KEEP, maxRows = CLEANUP_MAX_ROWS) {
  // 引数がない場合はスプレッドシートを取得
  if (!sheet) {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    sheet = ss.getSheets()[0];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    saveJsonToDrive(sheet);
    return; // データがない場合は終了
  }

  // 日付列（1列目）を取得
  const dateRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const dates = dateRange.getValues();

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (daysToKeep * 24 * 60 * 60 * 1000));

  // 削除する行のインデックスを収集
  // スプレッドシートは古い記事が上（小rowIndex）・新しい記事が下（大rowIndex）
  // → 新しい順にmaxRows件をキープし、それ以外（古い記事）を削除する
  const rowsToDelete = [];
  let keepCount = 0;

  // 新しい記事側（下）から走査してキープ数をカウント
  for (let i = dates.length - 1; i >= 0; i--) {
    const rowIndex = i + 2; // 実際の行番号（ヘッダー+1）
    const dateValue = dates[i][0];

    // 日付がDateオブジェクトか文字列かを判定
    let articleDate;
    if (dateValue instanceof Date) {
      articleDate = dateValue;
    } else if (typeof dateValue === 'string' && dateValue) {
      articleDate = new Date(dateValue);
      if (isNaN(articleDate.getTime())) {
        rowsToDelete.push(rowIndex); // 無効な日付は削除
        continue;
      }
    } else {
      rowsToDelete.push(rowIndex); // 日付なしは削除
      continue;
    }

    // 最新maxRows件 かつ 30日以内 → キープ、それ以外 → 削除
    if (keepCount < maxRows && articleDate >= cutoffDate) {
      keepCount++;
    } else {
      rowsToDelete.push(rowIndex);
    }
  }

  // 行を削除（下から上へ削除することでインデックスがずれない）
  if (rowsToDelete.length > 0) {
    // 連続した行はまとめて削除（効率的）
    rowsToDelete.sort((a, b) => b - a); // 降順ソート

    let deleteCount = 0;
    let startRow = rowsToDelete[0];
    let endRow = rowsToDelete[0];

    for (let i = 1; i < rowsToDelete.length; i++) {
      if (rowsToDelete[i] === endRow - 1) {
        // 連続している
        endRow = rowsToDelete[i];
      } else {
        // 連続が途切れたので削除
        const count = startRow - endRow + 1;
        sheet.deleteRows(endRow, count);
        deleteCount += count;
        startRow = rowsToDelete[i];
        endRow = rowsToDelete[i];
      }
    }

    // 最後の連続範囲を削除
    const count = startRow - endRow + 1;
    sheet.deleteRows(endRow, count);
    deleteCount += count;

    console.log(`🗑️ 古い記事 ${deleteCount} 件を削除しました（${daysToKeep}日以上前、または${maxRows}行超過）`);
  }

  saveJsonToDrive(sheet);
}

/**
 * 手動で古い記事を削除する関数（GASエディタから直接実行可能）
 * 使用例: manualCleanupOldArticles(30, 300)  // 30日以上前、最大300行
 * 使用例: manualCleanupOldArticles(7, 100)   // 7日以上前、最大100行（より積極的）
 * @param {number} daysToKeep 保持する日数（デフォルト: CLEANUP_DAYS_TO_KEEP）
 * @param {number} maxRows 最大保持行数（デフォルト: CLEANUP_MAX_ROWS）
 */
function manualCleanupOldArticles(daysToKeep = CLEANUP_DAYS_TO_KEEP, maxRows = CLEANUP_MAX_ROWS) {
  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const sheet = ss.getSheets()[0];
    cleanupAndSave(sheet, daysToKeep, maxRows);
    console.log(`✅ クリーンアップ完了: ${daysToKeep}日以上前の記事を削除、最大${maxRows}行保持`);
  } catch (e) {
    console.log(`❌ クリーンアップエラー: ${e.toString()}`);
    logError('Manual Cleanup', 'CLEANUP_ERROR', e, `daysToKeep: ${daysToKeep}, maxRows: ${maxRows}`);
  }
}

function saveJsonToDrive(sheet) {
  try {
    // 引数がない場合はスプレッドシートを取得
    if (!sheet) {
      const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
      sheet = ss.getSheets()[0];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues().reverse();
    const data = rows.map(r => ({
      date: Utilities.formatDate(new Date(r[0]), "JST", "yyyy/MM/dd"),
      title: r[1],
      url: r[2],
      summary: r[3],
      content: r[4],
      leakScore: r[5] || 50,
      review_en: r[7] || "",
      title_en: r[9] || "",
      summary_en: r[10] || "",
      content_en: r[11] || "",
      isMultiSource: (r[4] || '').includes('✅ 複数ソース確認済み')  // 統合記事フラグ
    }));

    const folder = DriveApp.getFolderById(getConfig('FOLDER_ID'));
    const props = PropertiesService.getScriptProperties();
    let fileId = props.getProperty('NEWS_JSON_FILE_ID');
    let file;

    // 保存済みのファイルIDがある場合、まずそれを使う
    if (fileId) {
      try {
        file = DriveApp.getFileById(fileId);
        file.setContent(JSON.stringify(data));
        console.log(`🔄 JSON Updated (Cached File ID: ${fileId})`);
      } catch (e) {
        // ファイルが見つからない場合はリセット
        console.log(`⚠️ Cached file ID invalid, searching folder...`);
        file = null;
        fileId = null;
      }
    }

    // ファイルIDが無い場合はフォルダ内を検索
    if (!file) {
      const files = folder.getFilesByName(JSON_FILE_NAME);
      if (files.hasNext()) {
        file = files.next();
        file.setContent(JSON.stringify(data));
        fileId = file.getId();
        console.log(`🔄 JSON Updated (Found in folder: ${fileId})`);

        // 重複ファイルがあれば削除
        while (files.hasNext()) {
          files.next().setTrashed(true);
        }
      } else {
        // 新規作成（初回のみ）
        file = folder.createFile(JSON_FILE_NAME, JSON.stringify(data), "application/json");
        fileId = file.getId();
        console.log(`🆕 JSON Created (New File ID: ${fileId})`);
      }

      // ファイルIDをScriptPropertiesに保存（次回以降使い回す）
      props.setProperty('NEWS_JSON_FILE_ID', fileId);
    }

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    console.log(`📁 File ID: ${fileId}`);
    console.log(`🔗 Download URL: https://drive.google.com/uc?export=download&id=${fileId}`);
  } catch (e) {
    console.log(`❌ 保存エラー: ${e.toString()}`);
    logError('Google Drive', 'JSON_SAVE', e, `ファイル名: ${JSON_FILE_NAME}`);
  }
}

/**
 * 🔧 ヘルパー関数: news.jsonのファイルIDを取得・表示
 * GASエディタからこの関数を手動実行すると、現在のファイルIDとダウンロードURLが表示されます。
 * GitHub Actionsのワークフローに設定するファイルIDを確認するのに使います。
 */
function getNewsJsonFileId() {
  const folder = DriveApp.getFolderById(getConfig('FOLDER_ID'));
  const files = folder.getFilesByName(JSON_FILE_NAME);

  if (files.hasNext()) {
    const file = files.next();
    const fileId = file.getId();

    // ScriptPropertiesにも保存
    PropertiesService.getScriptProperties().setProperty('NEWS_JSON_FILE_ID', fileId);

    console.log(`✅ news.json found!`);
    console.log(`📁 File ID: ${fileId}`);
    console.log(`🔗 Download URL: https://drive.google.com/uc?export=download&id=${fileId}`);
    console.log(`📋 ↑ このIDをGitHub Actionsのワークフローに設定してください`);

    // 共有設定を確認・更新
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    console.log(`🔓 共有設定: リンクを知っている全員が閲覧可能`);

    return fileId;
  } else {
    console.log(`❌ news.json not found in folder!`);
    console.log(`💡 saveJsonToDrive()を先に実行してファイルを作成してください`);
    return null;
  }
}

function getUsdJpyRate() {
  try {
    const response = UrlFetchApp.fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = JSON.parse(response.getContentText());
    return Math.floor(data.rates.JPY);
  } catch (e) {
    return 150;
  }
}

function calculateLeakScore(article) {
  const fullText = (article.title + ' ' + article.summary).toLowerCase();
  let score = 40;
  score += getSourceScore(article.url);
  score += getEvidenceScore(fullText);
  score += getSpecificityScore(fullText);
  score += getCertaintyScore(article.title, article.summary);
  score += getTimelinessScore(fullText);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSourceScore(url) {
  const d = extractDomain(url);
  const s = { 'apple.com': 30, 'samsung.com': 30, 'nvidia.com': 30, 'xcancel.com': 20, 'nitter.net': 15 };
  return s[d] || 15;
}

function getEvidenceScore(t) {
  let s = 0;
  if (/official|発表/.test(t)) s += 25;
  if (/benchmark|流出/.test(t)) s += 22;
  return s || 10;
}

function getSpecificityScore(t) {
  let s = 0;
  if (/\$|¥/.test(t)) s += 5;
  if (/GB|GHz/.test(t)) s += 4;
  return Math.min(20, s);
}

function getCertaintyScore(t, s) {
  const txt = (t + ' ' + s).toLowerCase();
  if (/confirmed/.test(txt)) return 15;
  if (/rumor/.test(txt)) return -10;
  return 0;
}

function getTimelinessScore(t) {
  if (/soon/.test(t)) return 10;
  return 0;
}

function extractDomain(u) {
  try {
    const match = u.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
    return match ? match[1].toLowerCase() : '';
  } catch (e) {
    return '';
  }
}

function getRecentHistory(s) {
  return { text: "", count: 0 };
}

// ----------------------------------------------------
// 投稿承認 Web アプリ（doGet で HTML を配信）
// ----------------------------------------------------
/**
 * GAS Web アプリのエントリーポイント
 * - ?action=news → news.json データを返す（GitHub Actionsから使用）
 * - その他       → 承認UI（HTML）を返す
 *
 * デプロイ: エディタ「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *   実行ユーザー: 「自分」 / アクセス: 「全員（匿名ユーザーを含む）」
 *   ※ news取得はアクセス「全員」が必要。承認UIへのアクセスはURLを秘匿で代替。
 *
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.HTML.HtmlOutput | GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  // ?action=news → スプレッドシートのデータをJSONで返す
  if (action === 'news') {
    try {
      const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
      const sheet = ss.getSheets()[0];
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) {
        return ContentService
          .createTextOutput('[]')
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues().reverse();
      const data = rows.map(r => ({
        date: Utilities.formatDate(new Date(r[0]), "JST", "yyyy/MM/dd"),
        title: r[1],
        url: r[2],
        summary: r[3],
        content: r[4],
        leakScore: r[5] || 50,
        review_en: r[7] || "",
        title_en: r[9] || "",
        summary_en: r[10] || "",
        content_en: r[11] || "",
        isMultiSource: (r[4] || '').includes('✅ 複数ソース確認済み')
      }));

      return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      console.error(`❌ doGet news error: ${err.message}`);
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Failed to fetch news' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // デフォルト → 承認UI（HTML）
  return HtmlService
    .createHtmlOutputFromFile('ApprovalUI')
    .setTitle('GADGET HUNTER 投稿承認')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}