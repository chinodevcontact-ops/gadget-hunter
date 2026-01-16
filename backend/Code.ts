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

/**
 * 設定値を取得するヘルパー関数
 * @param {string} key 
 * @return {string}
 */
function getConfig(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

// ▼ ノイズ除去用フィルター設定
const STRICT_FILTER = {
  MIN_LENGTH: 20,
  REQUIRE_MEDIA_OR_TAG: true,
  REQUIRED_KEYWORDS: /RTX|GTX|GeForce|Radeon|Ryzen|Core|Intel|AMD|Snapdragon|Dimensity|Exynos|Apple|M4|M5|A18|A19|GB|TB|MHz|GHz|Benchmark|Cinebench|Geekbench|3DMark|Leak|Rumor|Specs|Price|Release|Launch|Driver|Update|Windows|Android|iOS|AI|NVIDIA|TSMC|Samsung|Pixel|Xperia|ASUS|MSI/i
};

/**
 * エラーログをスプレッドシートに記録
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
    const errorMessage = error.toString ? error.toString() : String(error);
    
    errorSheet.appendRow([
      timestamp,
      source,
      errorType,
      errorMessage,
      context,
      '未対応'
    ]);
    
    console.log(`❌ [${errorType}] ${source}: ${errorMessage}`);
  } catch (e) {
    // エラーログ記録自体が失敗した場合はコンソールのみに出力
    console.log(`🚨 Failed to log error: ${e.toString()}`);
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
  const MAX_API_CALLS = 100; 

  for (const site of TARGETS) {
    if (apiCallCount >= MAX_API_CALLS) break;
    
    try {
      const res = UrlFetchApp.fetch(site.url.trim(), { 
        "headers": { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, 
        "muteHttpExceptions": true 
      });
      
      const items = parseRSSRegex(res.getContentText());
      const count = Math.min(items.length, 10); 

      for (let i = 0; i < count; i++) {
        if (apiCallCount >= MAX_API_CALLS) break;

        const item = items[i];
        if (!item.title || !item.link) continue;
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

        // 初期値
        let finalTitle = "【翻訳失敗】" + item.title; 
        let finalSummary = "AI生成失敗"; 
        let finalContent = `<p>${item.desc}</p>`;
        let finalReviewEn = "Failed.";
        let titleEn = item.title;           
        let summaryEn = "Generation failed"; 
        let contentEn = item.desc;           
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
        }

        apiCallCount++;
        leakScore = calculateLeakScore({ title: finalTitle, summary: finalSummary, content: finalContent, url: item.link });

        sheet.appendRow([
            Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd"), 
            finalTitle, item.link, finalSummary, finalContent, leakScore, "", finalReviewEn, "",
            titleEn, summaryEn, contentEn
        ]);
        
        if (apiCallCount < MAX_API_CALLS) {
            console.log("⏳ Cooling down (5s)..."); 
            Utilities.sleep(5000); 
        }
      }
    } catch (e) {
      console.log(`❌ サイトスキップ: ${site.name}`);
      logError(site.name, 'RSS_FETCH', e, `URL: ${site.url}`);
    }
  }
  
  retryFailedArticles();
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
  Role: Strict Tech News Editor & Translator.
  Task: Evaluate if this is a **Major Tech Leak/News**.

  [SOURCE]
  Title: ${originalTitle}
  Body: ${desc}

  [STRICT FILTER RULE]
  - If it's a casual reply, greeting, or minor noise -> Return JSON: null
  - If it's REAL Tech News -> Generate full JSON below.

  [CONTEXT]
  - Date: ${todayStr}
  - Rate: 1 USD = ${currentRate} JPY
  - Persona: 19-year-old Japanese gadget otaku (Passionate, Knowledgeable, Polite but geeky).
  - Tone: Professional yet enthusiastic (Desu/Masu style). Avoid "Onee-kotoba" or overly casual slang like "〜だわ".

  [OUTPUT REQUIREMENTS (Only if News)]
  1. Language: Japanese (Main) + English (Full Translation).
  2. Format: JSON ONLY.
  3. JSON Keys: 
     - "title_jp": Catchy title (JP).
     - "title_en": Catchy title (EN).
     - "summary_points": Array of 3 bullet points (JP).
     - "summary_points_en": Array of 3 bullet points (EN).
     - "body_text": Detailed summary (JP, Desu/Masu).
     - "body_text_en": Detailed summary (EN, Professional tone).
     - "review_text": Personal opinion (JP, Polite but passionate. e.g. "正直、このスペックは驚異的ですね...").
     - "review_text_en": Personal opinion (EN, Short & punchy for QuoteRT).
  `;
  
  const payload = { 
    "contents": [{ "parts": [{ "text": prompt }] }],
    "safetySettings": [ { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" } ]
  };

  const apiRes = UrlFetchApp.fetch(apiUrl, { 
    "method": "post", 
    "contentType": "application/json", 
    "payload": JSON.stringify(payload), 
    "muteHttpExceptions": true 
  });
  
  if (apiRes.getResponseCode() !== 200) throw new Error(`API Error ${apiRes.getResponseCode()}`);
  
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
function retryFailedArticles() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const startRow = Math.max(2, lastRow - 30 + 1);
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 12).getValues(); 
  
  const currentRate = getUsdJpyRate();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm");

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const isTranslationFailed = row[1].includes("【翻訳失敗】");
    const isEnglishMissing = row[9] === ""; 
    const isDone = row[8] === "DONE";

    if ((isTranslationFailed || isEnglishMissing) && row[2] && !isDone) {
       console.log(`🚑 Retrying/Filling English: ${row[1]}`);
       try {
         let sourceTitle = row[1].replace("【翻訳失敗】", "");
         let sourceBody = row[4]; 

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
         }
       } catch(e) { console.log("Retry failed"); }

       console.log("⏳ Cooling down (5s)...");
       Utilities.sleep(5000); 
    }
  }
}

// ----------------------------------------------------
// 3. X (Twitter) 自動投稿 - Task B: 2段階投稿実装
// ----------------------------------------------------
function checkAndTweetNewArticles() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
  const sheet = ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const range = sheet.getRange(2, 1, lastRow - 1, 8);
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
    
    // コバンザメ判定 (既存ロジック)
    if (targetUrl.includes("twitter.com") || targetUrl.includes("x.com") || targetUrl.includes("nitter")) {
        const idMatch = targetUrl.match(/\/status\/(\d+)/);
        if (idMatch) {
            const tweetId = idMatch[1];
            console.log(`🦈 Shark Triggered: ${tweetId}`);
            const quoteText = `${reviewEn}\n\nVia: ${MY_WEBSITE_URL}\n#GadgetHunter`;
            try {
                postTweet(quoteText, tweetId);
                sheet.getRange(2 + targetIndex, 7).setValue("QuoteRT済み");
                return;
            } catch(e) { 
                console.log(`Quote Error: ${e.message}`);
                logError('Twitter', 'QUOTE_RT', e, `記事: ${title.substring(0, 50)}`);
            }
        }
    }

    // ★★★ Task B: 2段階投稿 ★★★
    try {
      // 【Stage 1】テキストのみ
      let shortSummary = row[3].split('\n')[0].replace(/[•・]/g, '').trim().substring(0, 90);
      const mainText = `🚨【CONFIDENTIAL】\n\n${title}\n\n${shortSummary}...\n\n#GadgetHunter`;
      const mainTweetId = postMainText(mainText);
      
      if (!mainTweetId) {
        console.log("❌ メイン投稿失敗");
        return;
      }
      
      console.log(`✅ Stage 1 完了 (ID: ${mainTweetId})`);
      
      // 【Stage 2】5秒待機
      console.log("⏳ Cooling down (5s)...");
      Utilities.sleep(5000);
      
      const replyText = `👇 詳細はこちら\n${MY_WEBSITE_URL}`;
      postReplyUrl(replyText, mainTweetId);
      
      console.log(`✅ Stage 2 完了`);
      sheet.getRange(2 + targetIndex, 7).setValue("2段階投稿済み");
      
    } catch (e) { 
      console.log(`Tweet Error: ${e.message}`);
      logError('Twitter', 'TWO_STAGE_POST', e, `記事: ${title.substring(0, 50)}`);
    }
  }
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
  
  const oauthParams = { 
    oauth_consumer_key: TWITTER_API_KEY, 
    oauth_token: TWITTER_ACCESS_TOKEN, 
    oauth_signature_method: "HMAC-SHA1", 
    oauth_timestamp: Math.floor(Date.now()/1000).toString(), 
    oauth_nonce: Math.random().toString(36).substring(2), 
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
  
  const oauthParams = { 
    oauth_consumer_key: TWITTER_API_KEY, 
    oauth_token: TWITTER_ACCESS_TOKEN, 
    oauth_signature_method: "HMAC-SHA1", 
    oauth_timestamp: Math.floor(Date.now()/1000).toString(), 
    oauth_nonce: Math.random().toString(36).substring(2), 
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
  
  const oauthParams = { 
    oauth_consumer_key: TWITTER_API_KEY, 
    oauth_token: TWITTER_ACCESS_TOKEN, 
    oauth_signature_method: "HMAC-SHA1", 
    oauth_timestamp: Math.floor(Date.now()/1000).toString(), 
    oauth_nonce: Math.random().toString(36).substring(2), 
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

function cleanupAndSave(sheet) {
    // 引数がない場合はスプレッドシートを取得
    if (!sheet) {
      const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
      sheet = ss.getSheets()[0];
    }
    
    const lastRow = sheet.getLastRow();
    // ヘッダー1行 + データ300行 = 301行を超えたら古い記事を削除
    if (lastRow > 301) {
        const rowsToDelete = lastRow - 301;
        sheet.deleteRows(2, rowsToDelete);
        console.log(`🗑️ 古い記事 ${rowsToDelete} 件を削除しました`);
    }
    saveJsonToDrive(sheet);
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
      title: r[1], url: r[2], summary: r[3], content: r[4], leakScore: r[5] || 50,
      review_en: r[7] || "",
      title_en: r[9] || "", summary_en: r[10] || "", content_en: r[11] || ""
    }));
    
    const folder = DriveApp.getFolderById(getConfig('FOLDER_ID'));
    
    // 既存のファイルをすべて削除（クリーンアップ）
    const files = folder.getFilesByName(JSON_FILE_NAME);
    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
    
    // 新しいファイルを作成
    const file = folder.createFile(JSON_FILE_NAME, JSON.stringify(data), "application/json");
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    console.log(`🚀 JSON Updated (Global)`);
    console.log(`📁 File ID: ${file.getId()}`);
  } catch(e) { 
    console.log(`❌ 保存エラー: ${e.toString()}`);
    logError('Google Drive', 'JSON_SAVE', e, `ファイル名: ${JSON_FILE_NAME}`);
  }
}

function getUsdJpyRate() { 
  try{ 
    const response = UrlFetchApp.fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = JSON.parse(response.getContentText());
    return Math.floor(data.rates.JPY); 
  } catch(e) {
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
  if(/official|発表/.test(t)) s += 25; 
  if(/benchmark|流出/.test(t)) s += 22; 
  return s || 10; 
}

function getSpecificityScore(t) { 
  let s = 0; 
  if(/\$|¥/.test(t)) s += 5; 
  if(/GB|GHz/.test(t)) s += 4; 
  return Math.min(20, s); 
}

function getCertaintyScore(t, s) { 
  const txt = (t + ' ' + s).toLowerCase(); 
  if(/confirmed/.test(txt)) return 15; 
  if(/rumor/.test(txt)) return -10; 
  return 0; 
}

function getTimelinessScore(t) { 
  if(/soon/.test(t)) return 10; 
  return 0; 
}

function extractDomain(u) { 
  try{ 
    const match = u.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
    return match ? match[1].toLowerCase() : ''; 
  } catch(e) {
    return '';
  } 
}

function getRecentHistory(s) { 
  return { text: "", count: 0 }; 
}