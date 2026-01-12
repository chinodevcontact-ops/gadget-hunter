// Netlify Function: Google Drive APIをプロキシする
// APIキーはここに隠されるため、ブラウザからは見えません

exports.handler = async function(event, context) {
  // CORS対応のヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONSリクエスト（プリフライト）への対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Google Drive設定
  const FILE_ID = '1hteuEBEmsH0zThg-xmBPH7IYkwbnHVDA';
  const API_KEY = 'AIzaSyBI77-zVtm2AOzAKglBM9ngoZBU9IDOeDA';
  const API_URL = `https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media&key=${API_KEY}`;

  try {
    // Google Drive APIを呼び出す
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`Google Drive API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    
    return {
      statusCode: 200,
      headers,
      body: data
    };
  } catch (error) {
    console.error('Error fetching from Google Drive:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch data from Google Drive',
        message: error.message 
      })
    };
  }
};
