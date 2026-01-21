const fs = require('fs-extra');
const path = require('path');

// 設定（GADGET HUNTERの構造に合わせて調整）
const SOURCE_JSON = path.join(__dirname, '../frontend/data/news.json');
const TEMPLATE_HTML = path.join(__dirname, '../frontend/index.html');
const OUTPUT_DIR = path.join(__dirname, '../frontend/articles');
const BASE_URL = 'https://gadget-hunter-xi.vercel.app';

async function main() {
  console.log('🚀 Starting Static Generation for OGP...');

  // 1. データの読み込み
  if (!fs.existsSync(SOURCE_JSON)) {
    console.error(`❌ JSON file not found at: ${SOURCE_JSON}`);
    process.exit(1);
  }
  
  const newsData = await fs.readJson(SOURCE_JSON);
  console.log(`📊 Found ${newsData.length} articles`);
  
  let template = await fs.readFile(TEMPLATE_HTML, 'utf-8');

  // 2. 出力ディレクトリの初期化
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);

  // 3. テンプレートのパス修正（相対パス対策）
  // 階層が一つ深くなるため、CSS/JSの読み込みパスをルート相対パスに修正
  template = template.replace(/(href|src)="\.\//g, '$1="/'); // "./" → "/"
  template = template.replace(/(href|src)="(?!\/|http)([^"]+)"/g, '$1="/$2'); // 相対パス → ルート相対

  let count = 0;

  // 4. 各記事のHTML生成
  for (const article of newsData) {
    // URL用スラッグの生成（title_enまたはtitleから生成）
    const slug = generateSlug(article.title_en || article.title);
    
    // メタデータの準備
    const title = escapeHtml(article.title || 'Untitled');
    const description = escapeHtml(
      (article.summary || article.content || '')
        .replace(/\n/g, ' ')
        .replace(/<[^>]+>/g, '') // HTMLタグ除去
        .substring(0, 150)
    ) + '...';
    
    // 画像URLの決定（将来的に記事ごとの画像を追加する場合に備えて）
    const image = article.imageUrl || `${BASE_URL}/ogp-default.jpg`;
    const url = `${BASE_URL}/articles/${slug}`;

    // HTMLの置換処理
    let html = template;

    // <title>の置換
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${title} | GADGET HUNTER</title>`
    );

    // OGPタグの注入（</head>の直前に追加）
    const ogpTags = `
    <!-- Article-specific OGP tags (Generated at build time) -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${image}">
    <meta property="og:site_name" content="GADGET HUNTER">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
    <link rel="canonical" href="${url}">
    <meta name="description" content="${description}">
    `;

    html = html.replace('</head>', `${ogpTags}\n</head>`);

    // SEO用：ボディにもコンテンツを埋め込む（非表示だがクローラーには見える）
    const seoContent = `
    <div id="ssr-content" style="display:none;">
      <h1>${title}</h1>
      <article>
        <p>${description}</p>
        <time datetime="${article.date || ''}">${article.date || ''}</time>
      </article>
    </div>
    `;
    
    html = html.replace(
      '<div id="loading" class="loading-container">',
      `${seoContent}<div id="loading" class="loading-container">`
    );

    // ファイル書き出し
    // public/articles/slug/index.html の構造で生成
    const articleDir = path.join(OUTPUT_DIR, slug);
    await fs.ensureDir(articleDir);
    await fs.writeFile(path.join(articleDir, 'index.html'), html);

    console.log(`✅ Generated: articles/${slug}/index.html`);
    count++;
  }

  console.log(`\n🎉 Complete! Generated ${count} article pages with OGP tags.`);
  console.log(`📝 These pages will display rich cards on X (Twitter) and Facebook.`);
}

/**
 * タイトルからURL用のスラッグを生成
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

/**
 * HTMLエスケープ（XSS対策）
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// エラーハンドリング付きで実行
main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
