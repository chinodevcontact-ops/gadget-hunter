// Vercel Function: Google Drive APIをプロキシする
// APIキーはここに隠されるため、ブラウザからは見えません

module.exports = async function handler(req, res) {
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
    console.error('API_KEY is not set');
    return res.status(500).json({ 
      error: 'API key not configured',
      debug: {
        hasAPIKey: !!API_KEY,
        hasFileId: !!FILE_ID
      }
    });
  }
  
  console.log('API_KEY found, FILE_ID:', FILE_ID);
  
  const API_URL = `https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media&key=${API_KEY}`;

  try {
    console.log('Fetching from:', API_URL);
    
    // Google Drive APIを呼び出す
    const response = await fetch(API_URL);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Google Drive API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    console.log('Data received, length:', data.length);
    
    // JSONとして返す
    const jsonData = JSON.parse(data);
    return res.status(200).json(jsonData);
  } catch (error) {
    console.error('Error fetching from Google Drive:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Failed to fetch data from Google Drive',
      message: error.message,
      stack: error.stack
    });
  }
};
