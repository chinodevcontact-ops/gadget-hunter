// Vercel Function: Google Drive APIをプロキシする
// APIキーはここに隠されるため、ブラウザからは見えません

export default async function handler(req, res) {
  // CORS対応のヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Google Drive設定（環境変数から取得）
  const FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID || '1hteuEBEmsH0zThg-xmBPH7IYkwbnHVDA';
  const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  
  // APIキーが設定されていない場合はエラー
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }
  
  const API_URL = `https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media&key=${API_KEY}`;

  try {
    // Google Drive APIを呼び出す
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`Google Drive API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    
    // JSONとして返す
    return res.status(200).json(JSON.parse(data));
  } catch (error) {
    console.error('Error fetching from Google Drive:', error);
    
    return res.status(500).json({ 
      error: 'Failed to fetch data from Google Drive',
      message: error.message 
    });
  }
}
