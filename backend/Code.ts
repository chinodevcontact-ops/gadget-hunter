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
const MODEL_NAME = 'gemma-3-27b-it';

// ▼ データクリーンアップ設定
const CLEANUP_DAYS_TO_KEEP = 30; // 30日以上古い記事を削除
const CLEANUP_MAX_ROWS = 300;    // 最大300行まで保持（ヘッダー除く）
// 移行の合図: news.json が重い / GitHub Diff が辛い / GAS メモリ制限に当たり始めたら DB・月次アーカイブを検討

// ==========================================
// 🧠 プロンプト設定定数
// ==========================================
const PERSONA_CONFIG = {
  age: 19,
  pc: { cpu: '個人機材（非公開）', gpu: '個人機材（非公開）' },
  mobile: ['Android端末（機種名は非公開）'],
  games: ['CoD Warzone', 'Minecraft', 'ARK: Survival Ascended'],
  philosophy: 'Performance per Yen > Brand Loyalty',
  budget: { tooExpensive: '20万円', acceptable: '10万円前後', godTier: 'コスパ重視モデル' },
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
  REQUIRED_KEYWORDS: /RTX|GTX|GeForce|Radeon|Ryzen|Core|Intel|AMD|Snapdragon|Dimensity|Exynos|Apple|M4|M5|A18|A19|GB|TB|MHz|GHz|Benchmark|Cinebench|Geekbench|3DMark|Leak|Rumor|Specs|Price|Release|Launch|Driver|Update|Windows|Android|iOS|AI|NVIDIA|TSMC|Samsung|Pixel|Xperia|ASUS|MSI|OpenAI|GPT|ChatGPT|Claude|Anthropic|Gemini|LLM|Llama|Mistral|Copilot/i,
  // ゲーム系除外（広めにフィルター）
  EXCLUDE_KEYWORDS: /\b(PS5|PS4|PlayStation|Xbox|Nintendo|Switch|Steam|Epic Games|GOG|Origin|Battle\.?net|Ubisoft|EA Sports|Activision|Blizzard|Rockstar|game|games|gaming|gamer|esports|e-sports|RPG|MMORPG|FPS|MOBA|battle royale|DLC|expansion pack|patch notes|season pass|loot box|microtransaction|playthrough|speedrun|walkthrough|boss fight|multiplayer|singleplayer|co-op|PvP|PvE|NPC|quest|level up|XP|achievement|trophy|Fortnite|Call of Duty|COD|Warzone|GTA|Grand Theft Auto|Minecraft|Elden Ring|Baldur|Starfield|Hogwarts|Diablo|World of Warcraft|WoW|League of Legends|LoL|Valorant|Apex Legends|PUBG|Overwatch|Cyberpunk|Assassin.*Creed|Final Fantasy|Zelda|Mario|Pokemon|Pokémon|Sonic|Halo|Destiny|Monster Hunter|Resident Evil|Silent Hill|Metal Gear|Dark Souls|Bloodborne|Sekiro|God of War|Spider-Man|Horizon|Ratchet|Uncharted|Last of Us|Ghost of Tsushima|Death Stranding|Persona|Yakuza|Like a Dragon|Tekken|Street Fighter|Mortal Kombat|Smash Bros|Animal Crossing|Splatoon|Kirby|Fire Emblem|Xenoblade|Metroid|Castlevania|Hollow Knight|Hades|Celeste|Stardew|Terraria|Palworld|Lethal Company|Among Us|Fall Guys|Rocket League|FIFA|NBA 2K|Madden|WWE|Gran Turismo|Forza|Need for Speed|Genshin|Honkai|Wuthering|Tower of Fantasy|Blue Archive|Arknights|Azur Lane|Fate.Grand|FGO|Nikke|Zenless|Reverse.1999)\b/i
};

// ▼ 検索補助設定（記事が薄くなるケースを補強）
const SEARCH_ENRICHMENT = {
  ENABLED: true,
  MAX_RESULTS: 4,
  MIN_SNIPPET_LENGTH: 80
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
 * 検索クエリを生成（型番優先、なければキーワード抽出）
 * @param {string} title
 * @param {string} desc
 * @return {string}
 */
function buildSearchQuery(title, desc) {
  const ids = extractProductIdentifiers(`${title || ''} ${desc || ''}`);
  if (ids.length > 0) {
    return ids.slice(0, 3).join(' ');
  }

  const text = `${title || ''} ${desc || ''}`.toLowerCase();
  const words = (text.match(/[a-z0-9][a-z0-9+\-]{2,}/g) || [])
    .filter(w => !/^(with|from|this|that|have|will|would|about|after|before|their|there|where|which|while|launch|report|rumor|leak|news|today|update|official|specs)$/.test(w));

  const uniq = [];
  for (const w of words) {
    if (!uniq.includes(w)) uniq.push(w);
    if (uniq.length >= 5) break;
  }
  return uniq.join(' ');
}

/**
 * 外部検索コンテキストを取得（Google News RSS）
 * - 取得失敗時は空文字を返し、本処理は継続
 * @param {string} title
 * @param {string} desc
 * @param {string} sourceUrl
 * @return {string}
 */
function fetchSearchContext(title, desc, sourceUrl) {
  if (!SEARCH_ENRICHMENT.ENABLED) return '';

  const query = buildSearchQuery(title, desc);
  if (!query) return '';

  try {
    const q = encodeURIComponent(`${query} gadget OR tech`);
    const searchUrl = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
    const res = UrlFetchApp.fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return '';

    const sourceDomain = extractDomain(sourceUrl || '');
    const relatedItems = parseRSSRegex(res.getContentText())
      .filter(it => it && it.title && it.desc)
      .filter(it => calculateSimilarity(title, it.title) < 0.95)
      .filter(it => !sourceDomain || extractDomain(it.link) !== sourceDomain)
      .filter(it => it.desc.length >= SEARCH_ENRICHMENT.MIN_SNIPPET_LENGTH)
      .slice(0, SEARCH_ENRICHMENT.MAX_RESULTS);

    if (relatedItems.length === 0) return '';

    const lines = relatedItems.map((it, idx) => {
      const snippet = it.desc.replace(/\s+/g, ' ').trim().substring(0, 220);
      return `${idx + 1}. ${it.title}\n   - ${snippet}`;
    });

    return `\n[外部検索コンテキスト]\nクエリ: ${query}\n${lines.join('\n')}\n`;
  } catch (e) {
    console.log(`⚠️ 検索補強スキップ: ${e.message}`);
    return '';
  }
}

/**
 * 型番・ダイ名・スペック値などの識別子を抽出（誤統合/誤生成の防止用）
 * @param {string} text
 * @return {string[]}
 */
function extractProductIdentifiers(text) {
  if (!text) return [];
  const patterns = [
    /\b(?:RTX|GTX|RX)\s?\d{3,4}(?:\s?(?:TI|SUPER))?\b/gi,
    /\b(?:GB|AD|GA|TU|NAVI)\d{2,4}(?:-[A-Za-z0-9]+){0,4}\b/gi,
    /\b[A-Z]{2,6}\d{2,4}(?:-[A-Za-z0-9]+){1,4}\b/g,
    /\bGDDR\d+X?\b/gi,
    /\b\d{2,4}-?bit\b/gi,
    /\b\d{2,4}\s?W(?:\s?TDP)?\b/gi,
    /\b\d+\s?(?:GB|TB|MB)\b/gi,
    /\b\d+\s?(?:FP32|CUDA|CU|SM|SP)\b/gi,
    /\b\d+\s?(?:MHz|GHz)\b/gi,
    /\bSnapdragon\s?\d{3,4}(?:\s?(?:Plus|Ultra|Elite))?\b/gi,
    /\bDimensity\s?\d{3,4}(?:-[A-Za-z0-9]+)?\b/gi,
    /\bExynos\s?\d{4}\b/gi,
    /\bApple\s?[AM]\d{1,2}(?:\s?(?:Pro|Max|Ultra))?\b/gi
  ];

  const ids = new Set();
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const m of matches) {
      ids.add(m.toUpperCase().replace(/\s+/g, ' ').trim());
    }
  }
  return [...ids];
}

/**
 * 既存記事との統合可否を判定
 * @param {{title: string, desc: string}} incoming
 * @param {{title: string, summary: string, content: string}} existing
 * @return {boolean}
 */
function shouldMergeArticles(incoming, existing) {
  const incomingIds = extractProductIdentifiers(`${incoming.title || ''} ${incoming.desc || ''}`);
  const existingIds = extractProductIdentifiers(`${existing.title || ''} ${existing.summary || ''} ${existing.content || ''}`);

  // 識別子が取れないケースは従来どおり統合許可
  if (incomingIds.length === 0 || existingIds.length === 0) return true;

  const existingSet = new Set(existingIds);
  const overlap = incomingIds.filter(id => existingSet.has(id));
  return overlap.length > 0;
}

/**
 * 生成結果に情報源外の型番が混入していないか判定
 * @param {GeminiResponse} generatedData
 * @param {string} sourceTitle
 * @param {string} sourceDesc
 * @return {boolean}
 */
function hasIdentifierMismatch(generatedData, sourceTitle, sourceDesc) {
  if (!generatedData) return false;
  const sourceIds = extractProductIdentifiers(`${sourceTitle || ''} ${sourceDesc || ''}`);
  if (sourceIds.length === 0) return false;

  const generatedText = [
    generatedData.title_jp || '',
    generatedData.title_en || '',
    Array.isArray(generatedData.summary_points) ? generatedData.summary_points.join(' ') : '',
    Array.isArray(generatedData.summary_points_en) ? generatedData.summary_points_en.join(' ') : '',
    generatedData.body_text || '',
    generatedData.body_text_en || ''
  ].join(' ');

  const generatedIds = extractProductIdentifiers(generatedText);
  if (generatedIds.length === 0) return false;

  const sourceSet = new Set(sourceIds);
  return generatedIds.some(id => !sourceSet.has(id));
}

/**
 * 型番不整合を検知した際の安全なフォールバック生成
 * @param {string} originalTitle
 * @param {string} desc
 * @return {GeminiResponse}
 */
function buildSafeFallbackFromSource(originalTitle, desc) {
  const normalized = (desc || '').replace(/\s+/g, ' ').trim();
  const sentences = normalized
    .split(/[。.!?]\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const summaryPoints = sentences.length > 0
    ? sentences.map(s => s.substring(0, 120))
    : ['情報源の本文を優先し、型番・数値は原文ベースで記載。'];

  return {
    title_jp: originalTitle || 'Source-based fallback',
    title_en: originalTitle || 'Source-based fallback',
    summary_points: summaryPoints,
    summary_points_en: ['Source-based fallback due to identifier mismatch.'],
    body_text: `<p>${escapeHtml(desc || '')}</p><p><em>※ 型番不一致を検知したため、原文ベースで表示しています。</em></p>`,
    body_text_en: `<p>${escapeHtml(desc || '')}</p><p><em>Identifier mismatch detected. Source-based fallback applied.</em></p>`,
    review_text: '型番の不一致を検知したため、推測を避けて原文ベースで整理しました。',
    review_text_en: 'Identifier mismatch detected. Kept source facts only.'
  };
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

  // ヘッダー拡張（13列目に元ソース追加）
  if (sheet.getLastRow() > 0) {
    const header = sheet.getRange(1, 1, 1, 13).getValues()[0];
    if (header[7] !== '英語レビュー') sheet.getRange(1, 8).setValue('英語レビュー');
    if (header[8] !== '再試行済み') sheet.getRange(1, 9).setValue('再試行済み');
    if (header[9] !== 'タイトル(英)') sheet.getRange(1, 10).setValue('タイトル(英)');
    if (header[10] !== '要約(英)') sheet.getRange(1, 11).setValue('要約(英)');
    if (header[11] !== '本文(英)') sheet.getRange(1, 12).setValue('本文(英)');
    if (header[12] !== '元ソース') sheet.getRange(1, 13).setValue('元ソース');
  } else {
    sheet.appendRow([
      '日付', 'タイトル', 'URL', '要約', '詳細本文', '注目度', 'ツイート状態',
      '英語レビュー', '再試行済み', 'タイトル(英)', '要約(英)', '本文(英)', '元ソース'
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

  // ガジェット系 + AI企業（ゲーム系は除外）
  const TARGETS = [
    // GPU/CPU専門メディア
    { name: 'TechPowerUp', url: 'https://www.techpowerup.com/rss/news' },
    { name: 'VideoCardz', url: 'https://videocardz.com/feed' },
    // GPU/CPUリーカー
    { name: 'kopite7kimi', url: 'https://nitter.net/kopite7kimi/rss' },
    { name: 'momomo_us', url: 'https://nitter.net/momomo_us/rss' },
    { name: 'HXL', url: 'https://nitter.net/9550pro/rss' },
    // スマホ系リーカー
    { name: 'Ice Universe', url: 'https://nitter.net/UniverseIce/rss' },
    { name: 'OnLeaks', url: 'https://nitter.net/OnLeaks/rss' },
    // Apple/ガジェット
    { name: 'MacRumors', url: 'https://www.macrumors.com/macrumors.xml' },
    // 公式
    { name: 'NVIDIA News', url: 'https://nvidianews.nvidia.com/releases.xml' },
    // AI企業
    { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
    { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
    { name: 'Microsoft AI Blog', url: 'https://blogs.microsoft.com/ai/feed/' },
    { name: 'Anthropic News', url: 'https://www.anthropic.com/news/rss.xml' }
  ];

  console.log(`🤖 System Online: ${MODEL_NAME} (v14.1-JSDoc)`);

  let apiCallCount = 0;
  const MAX_API_CALLS = 10;  // gemma-3-27b-it: rate limit 未知数のため安全値
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
        const combinedText = `${item.title} ${item.desc}`;

        // URL検証（インジェクション対策）
        if (!isValidUrl(item.link)) {
          console.log(`🚫 Invalid URL detected: ${item.link}`);
          continue;
        }

        if (savedUrls.includes(item.link)) continue;

        // 全ソース共通: ゲーム系トピックは除外
        if (STRICT_FILTER.EXCLUDE_KEYWORDS && STRICT_FILTER.EXCLUDE_KEYWORDS.test(combinedText)) {
          console.log(`🎮 ゲーム系を除外: ${item.title.substring(0, 60)}...`);
          continue;
        }

        // 構造チェック
        if (site.url.includes("nitter") || site.url.includes("xcancel")) {
          if (item.title.startsWith("R to ") || item.title.startsWith("@")) continue;
          if (item.desc.length < STRICT_FILTER.MIN_LENGTH) continue;

          const hasLinkOrTag = /http|#/.test(item.desc);
          const hasKeyword = STRICT_FILTER.REQUIRED_KEYWORDS.test(combinedText);

          if (STRICT_FILTER.REQUIRE_MEDIA_OR_TAG && !hasLinkOrTag) continue;
          if (!hasKeyword) continue;
        }

        // 重複チェック：過去24時間の記事と類似していないか確認
        const duplicateArticle = findDuplicate(item.title, recentTitles, 0.7);
        if (duplicateArticle && shouldMergeArticles(
          { title: item.title, desc: item.desc },
          { title: duplicateArticle.title, summary: duplicateArticle.summary, content: duplicateArticle.content }
        )) {
          // 重複検出 → 新規descだけで再生成（AI生成済み本文を情報源にしない）
          console.log(`📝 情報統合モード: 新規ソースで既存記事を更新します`);
          try {
            // 新規情報のdescだけで生成（既存AI本文を混ぜない = 誤情報増幅を防止）
            const mergedData = callGeminiAPI(item.title, item.desc, todayStr, currentRate, pastMemory.text, item.link);

            if (mergedData) {
              // 型番チェック（統合時も実施）
              if (hasIdentifierMismatch(mergedData, item.title, item.desc)) {
                console.log(`⚠️ 統合時も型番不一致を検知。スコア加算のみ実施: ${item.title.substring(0, 50)}...`);
                const updatedLeakScore = Math.min(100, duplicateArticle.leakScore + 10);
                sheet.getRange(duplicateArticle.rowIndex, 6).setValue(updatedLeakScore);
              } else {
                // 既存記事を更新
                const updatedLeakScore = Math.min(100, duplicateArticle.leakScore + 15);
                const updatedSummary = mergedData.summary_points ? mergedData.summary_points.map(s => "• " + s).join('\n') : duplicateArticle.summary;
                const updatedContent = `${mergedData.body_text}<h3>中の人の本音 (JP)</h3><p>${mergedData.review_text}</p><p class="multi-source">✅ 複数ソース確認済み</p>`;

                sheet.getRange(duplicateArticle.rowIndex, 4).setValue(updatedSummary);
                sheet.getRange(duplicateArticle.rowIndex, 5).setValue(updatedContent);
                sheet.getRange(duplicateArticle.rowIndex, 6).setValue(updatedLeakScore);

                console.log(`✅ 統合完了: Leak Score ${duplicateArticle.leakScore} → ${updatedLeakScore}`);
              }
              apiCallCount++;
            }
          } catch (e) {
            console.log(`⚠ 統合エラー: ${e.message}`);
            logError(site.name, 'MERGE_ARTICLE', e, `記事: ${item.title.substring(0, 50)}...`);
          }
          continue; // 新規記事としては追加しない
        } else if (duplicateArticle) {
          console.log(`⚠️ 類似タイトルだが識別子不一致のため統合をスキップ: ${item.title.substring(0, 60)}...`);
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
          const generatedData = callGeminiAPI(item.title, item.desc, todayStr, currentRate, pastMemory.text, item.link);

          if (!generatedData) {
            console.log(`🗑️ AI判定ノイズ: ${item.title}`);
            continue;
          }

          if (generatedData) {
            const safeData = hasIdentifierMismatch(generatedData, item.title, item.desc)
              ? buildSafeFallbackFromSource(item.title, item.desc)
              : generatedData;

            if (safeData !== generatedData) {
              console.log(`⚠️ 型番不一致を検知。原文ベースにフォールバック: ${item.title.substring(0, 60)}...`);
            }

            finalTitle = safeData.title_jp;
            if (Array.isArray(safeData.summary_points)) {
              finalSummary = safeData.summary_points.map(s => "• " + s).join('\n');
            }
            finalContent = `${safeData.body_text}<h3>中の人の本音 (JP)</h3><p>${safeData.review_text}</p>`;
            finalReviewEn = safeData.review_text_en || "Wow.";

            titleEn = safeData.title_en || item.title;
            if (Array.isArray(safeData.summary_points_en)) {
              summaryEn = safeData.summary_points_en.map(s => "• " + s).join('\n');
            } else { summaryEn = safeData.body_text_en.substring(0, 100) + "..."; }
            contentEn = `${safeData.body_text_en}<h3>Review (EN)</h3><p>${safeData.review_text_en}</p>`;

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
          titleEn, summaryEn, contentEn, item.desc.substring(0, 5000)
        ]);

        if (!rateLimitHit && apiCallCount < MAX_API_CALLS) {
          humanLikeSleep(4000, 7000); // 4〜7秒待機（gemini-2.0-flash-lite: 30 RPM）
        }
      }
    } catch (e) {
      console.log(`❌ サイトスキップ: ${site.name}`);
      logError(site.name, 'RSS_FETCH', e, `URL: ${site.url}`);
    }
  }

  if (rateLimitHit) {
    console.log('⚠️ Rate limit hit during this run. Skipping retry, saving current state...');
    cleanupAndSave(sheet); // 今処理できた分だけ保存して終了
  } else {
    retryFailedArticles(30); // 通常実行時は直近30行のみ（パフォーマンス考慮）
    cleanupAndSave(sheet);
  }

  // 記事更新後に承認待ちキューを1件だけ補充（トリガー未設定時の取りこぼし防止）
  try {
    checkAndTweetNewArticles();
  } catch (e) {
    console.log(`⚠️ 承認待ちキュー追加に失敗: ${e.message}`);
    logError('Queue', 'ENQUEUE_AFTER_FETCH', e, 'fetchAndSummarizeToSheet');
  }
  console.log(`✅ Run complete. Processed ${apiCallCount} articles.`);
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
 * @param {string} sourceUrl
 * @return {GeminiResponse|null}
 */
function callGeminiAPI(originalTitle, desc, todayStr, currentRate, memoryText, sourceUrl = '') {
  const API_KEY = getConfig('GEMINI_API_KEY');
  const modelId = MODEL_NAME.split('/').pop() || MODEL_NAME;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  // A: 多段生成 - Step 1: 情報源からスペックを抽出
  const extractedSpecs = extractProductIdentifiers(`${originalTitle} ${desc}`);
  const specsConstraint = extractedSpecs.length > 0
    ? `\n【使用許可された識別子リスト】\n${extractedSpecs.join(', ')}\n※ 上記リスト以外の型番・数値は絶対に使用禁止。`
    : '';
  const searchContext = fetchSearchContext(originalTitle, desc, sourceUrl);

  // B: プロンプト簡素化 - 事実優先ルールを最上部に
  const prompt = `
# 最重要ルール（これを破ると失格）
1. **情報源にない型番・チップ名・数値は絶対に書かない**
2. **型番は情報源の表記に1文字も違わず一致させる**
3. **推測・補完・想像で情報を追加しない**
4. **外部検索コンテキストは背景説明専用。数値・固有名詞は必ず情報源を優先**
${specsConstraint}

# タスク
以下の情報源を元に、テック記事を生成せよ。

[情報源]
タイトル: ${originalTitle}
内容: ${desc}
${searchContext}

[コンテキスト]
- 日付: ${todayStr}
- 為替: 1ドル=${currentRate}円

---

# 出力形式
2つの視点で記事を生成:
1. **body_text / summary_points**: プロのテックライター視点（客観的・報道調）
2. **review_text**: 19歳ゲーマー学生の本音（敬語ベース、スラング自然混じり）

## body_text / summary_points のルール
- 報道文体：「〜が明らかになった」「〜と報告されている」
- 一人称禁止（「僕」「私」は使わない）
- 情報源にある事実のみ記述
- summary_pointsは3点の箇条書き

## review_text のルール
- 敬語ベースだがスラングOK
- 「正直」「個人的には」「様子見安定」などの口癖を使用
- 絵文字・感嘆符は控えめに
- review_text_en は100文字以内の短いリアクション

# 出力JSON
{
  "title_jp": "日本語タイトル（45文字以内）",
  "title_en": "English title",
  "summary_points": ["事実1", "事実2", "事実3"],
  "summary_points_en": ["Fact 1", "Fact 2", "Fact 3"],
  "body_text": "<p>日本語本文（HTML）</p>",
  "body_text_en": "<p>English body (HTML)</p>",
  "review_text": "中の人の本音",
  "review_text_en": "Short reaction"
}

テック記事でなければ null を返せ。JSONのみ出力。
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
        // row[4]はAI生成済み本文の可能性があるので、元URLから再取得は重いため
        // タイトルだけで再生成（型番チェック付き）
        const sourceDesc = sourceTitle;

        const gen = callGeminiAPI(sourceTitle, sourceDesc, todayStr, currentRate, "", "");
        if (gen) {
          // リトライ時も型番チェック
          if (hasIdentifierMismatch(gen, sourceTitle, sourceDesc)) {
            console.log(`⚠️ リトライ時も型番不一致。スキップ: ${sourceTitle.substring(0, 50)}...`);
            sheet.getRange(startRow + i, 9).setValue("SKIP_MISMATCH");
            continue;
          }

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

      humanLikeSleep(4000, 7000); // 4〜7秒待機（gemini-2.0-flash-lite: 30 RPM）
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
  const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
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
  const row = sheet.getRange(pendingRowId, 1, 1, 10).getValues()[0];
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

/**
 * 指定した記事行を除外し、紐づく承認待ちキューを破棄する
 * 例: discardArticleAndPendingByRow(7)
 * @param {number} articleRowIndex - メインシートの行番号（2始まり）
 * @return {{ok: boolean, message: string, discardedQueueCount?: number}}
 */
function discardArticleAndPendingByRow(articleRowIndex) {
  if (!articleRowIndex || articleRowIndex < 2) {
    return { ok: false, message: 'articleRowIndex は2以上を指定してください' };
  }

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const mainSheet = ss.getSheets()[0];
    const lastRow = mainSheet.getLastRow();
    if (articleRowIndex > lastRow) {
      return { ok: false, message: `指定行が存在しません: ${articleRowIndex}` };
    }

    // ツイート状態を除外に更新（行自体は残す）
    mainSheet.getRange(articleRowIndex, 7).setValue('除外');

    const pendingSheet = getOrCreatePendingSheet();
    const pendingLastRow = pendingSheet.getLastRow();
    let discarded = 0;
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

    if (pendingLastRow >= 2) {
      const data = pendingSheet.getRange(2, 1, pendingLastRow - 1, 10).getValues();
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const pendingArticleRow = parseInt(row[6], 10);
        const status = (row[8] || '').toString();
        if (pendingArticleRow === articleRowIndex && status === 'pending') {
          pendingSheet.getRange(i + 2, 9).setValue('discarded');
          pendingSheet.getRange(i + 2, 10).setValue(now);
          discarded++;
        }
      }
    }

    return {
      ok: true,
      message: `記事行 ${articleRowIndex} を除外し、承認待ち ${discarded} 件を破棄しました`,
      discardedQueueCount: discarded
    };
  } catch (e) {
    logError('Queue', 'DISCARD_BY_ARTICLE_ROW', e, `row: ${articleRowIndex}`);
    return { ok: false, message: (e && e.message) || '処理に失敗しました' };
  }
}

function checkAndTweetNewArticles() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // データ行のみ（2行目〜最終行）を取得
  const range = sheet.getRange(2, 1, lastRow - 1, 10);
  const data = range.getValues();

  const PRIORITY_REGEX = /RTX|GTX|GeForce|NVIDIA|Radeon|AMD|Ryzen|Intel|Core|GPU|CPU|Motherboard|ASRock|ASUS|MSI|GIGABYTE|ZOTAC|Kopite7kimi|Leak|Spec/i;

  let targetIndex = -1;

  // 【フェーズ1】優先キーワード
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const tweetStatus = (row[6] || '').toString().trim();
    if (tweetStatus === "" && row[1] && !row[1].includes("【翻訳失敗】") && PRIORITY_REGEX.test(row[1] + " " + row[3])) {
      console.log(`⚡ 優先ターゲット発見: ${row[1]}`);
      targetIndex = i;
      break;
    }
  }

  // 【フェーズ2】通常
  if (targetIndex === -1) {
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const tweetStatus = (row[6] || '').toString().trim();
      if (tweetStatus === "" && row[1] && !row[1].includes("【翻訳失敗】")) {
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
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * 古い記事を削除（日付ベース + 行数制限の両方でチェック）
 * @param {Sheet} sheet スプレッドシートのシートオブジェクト
 * @param {number} daysToKeep 保持する日数（デフォルト: CLEANUP_DAYS_TO_KEEP）
 * @param {number} maxRows 最大保持行数（デフォルト: CLEANUP_MAX_ROWS）
 */
/**
 * 時間トリガーから直接呼ぶためのラッパー。
 * トリガーは第1引数にイベントオブジェクトを渡すため、cleanupAndSave を直接トリガーに登録すると
 * sheet 引数にイベントオブジェクトが入り 100% エラーになる。このラッパーを使うこと。
 */
function runCleanupAndSave() {
  cleanupAndSave(null);
}

function cleanupAndSave(sheet, daysToKeep = CLEANUP_DAYS_TO_KEEP, maxRows = CLEANUP_MAX_ROWS) {
  // 引数がない場合、またはトリガー経由でイベントオブジェクトが渡された場合はスプレッドシートを取得
  if (!sheet || typeof sheet.getLastRow !== 'function') {
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
// 🧪 X投稿テスト関数（GASエディタから直接実行可能）
// ----------------------------------------------------
/**
 * X（Twitter）への投稿が正常に動作するかテストする関数
 * GASエディタで testXPost() を実行すると、テストツイートを投稿して結果を確認できる
 * ※ 投稿後に自動削除はしないので、手動で削除してください
 */
function testXPost() {
  const testText = `🧪 GADGET HUNTER 動作テスト\nTimestamp: ${new Date().toISOString()}\n#GadgetHunter #test`;

  console.log('🚀 X投稿テストを開始...');
  console.log(`📝 テスト本文: ${testText}`);

  try {
    const TWITTER_API_KEY = getConfig('TWITTER_API_KEY');
    const TWITTER_API_SECRET = getConfig('TWITTER_API_SECRET');
    const TWITTER_ACCESS_TOKEN = getConfig('TWITTER_ACCESS_TOKEN');
    const TWITTER_ACCESS_SECRET = getConfig('TWITTER_ACCESS_SECRET');

    const url = "https://api.twitter.com/2/tweets";
    const payload = { "text": testText };

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

    const statusCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`📡 HTTP Status: ${statusCode}`);
    console.log(`📄 Response Body: ${responseBody}`);

    if (statusCode === 201 || statusCode === 200) {
      const responseData = JSON.parse(responseBody);
      if (responseData.data && responseData.data.id) {
        console.log(`✅ 投稿成功！ Tweet ID: ${responseData.data.id}`);
        console.log(`🔗 URL: https://x.com/i/status/${responseData.data.id}`);
      }
    } else {
      console.log('❌ 投稿失敗。上記のレスポンスを確認してください。');
      console.log('💡 よくあるエラー:');
      console.log('   401 → APIキーまたはOAuth署名が無効');
      console.log('   403 → アプリの権限不足（Read+Write必要）/ アカウント制限');
      console.log('   429 → Rate Limit超過');
    }
  } catch (e) {
    console.error(`❌ エラー: ${e.message}`);
  }
}

/**
 * X API認証のみを確認（投稿はしない）
 * GAS スクリプトプロパティに必要なキーが設定されているかチェック
 */
function checkXApiConfig() {
  const keys = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'];
  let allOk = true;

  console.log('🔑 X API 設定チェック...');
  for (const key of keys) {
    const value = getConfig(key);
    if (value) {
      console.log(`  ✅ ${key}: 設定済み (${value.substring(0, 4)}...)`);
    } else {
      console.log(`  ❌ ${key}: 未設定`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log('✅ 全てのAPIキーが設定されています。testXPost() で実際の投稿テストが可能です。');
  } else {
    console.log('❌ 未設定のキーがあります。GASエディタの「プロジェクトの設定」→「スクリプトプロパティ」で設定してください。');
  }
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

  // ?action=pending → 承認待ちキューをJSONで返す（デバッグ/外部確認用）
  if (action === 'pending') {
    try {
      const pending = getPendingTweets();
      return ContentService
        .createTextOutput(JSON.stringify({
          count: pending.length,
          items: pending
        }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      console.error(`❌ doGet pending error: ${err.message}`);
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Failed to fetch pending queue' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // デフォルト → 承認UI（HTML）
  return HtmlService
    .createHtmlOutputFromFile('ApprovalUI')
    .setTitle('GADGET HUNTER 投稿承認')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ----------------------------------------------------
// 🔍 使用可能モデル一覧（GASエディタから手動実行）
// ----------------------------------------------------
/**
 * Gemini API で使用可能なモデルの一覧をコンテキスト上限付きでログ出力する。
 * GAS エディタ上で listAvailableModels を選択して「実行」するだけで確認できる。
 * RPM は API では返ってこないため、AI Studio で確認すること:
 *   https://aistudio.google.com/rate-limit
 */
function listAvailableModels() {
  const API_KEY = getConfig('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}&pageSize=100`;

  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    console.error(`❌ API Error ${res.getResponseCode()}: ${res.getContentText()}`);
    return;
  }

  const json = JSON.parse(res.getContentText());
  const models = (json.models || []).filter(m =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );

  models.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Gemini API 使用可能モデル一覧 (generateContent 対応のみ)`);
  console.log(`  RPM確認: https://aistudio.google.com/rate-limit`);
  console.log(`${'='.repeat(70)}`);
  console.log(`${'モデルID'.padEnd(42)} ${'入力ctx'.padStart(10)} ${'出力ctx'.padStart(10)}`);
  console.log(`${'-'.repeat(70)}`);

  for (const m of models) {
    const id = (m.name || '').replace('models/', '');
    const inputCtx = (m.inputTokenLimit  || 0).toLocaleString();
    const outputCtx = (m.outputTokenLimit || 0).toLocaleString();
    console.log(`${id.padEnd(42)} ${inputCtx.padStart(10)} ${outputCtx.padStart(10)}`);
  }

  console.log(`${'='.repeat(70)}`);
  console.log(`  現在使用中: ${MODEL_NAME}`);
  console.log(`${'='.repeat(70)}\n`);
}