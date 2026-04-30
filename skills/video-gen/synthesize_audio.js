/**
 * VOICEVOX Audio Synthesizer
 * 
 * Sends script text to VOICEVOX API (localhost:50021)
 * Speaker: ずんだもん (ID: 3)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const VOICEVOX_HOST = 'localhost';
const VOICEVOX_PORT = 50021;
const SPEAKER_ID = 3; // ずんだもん
const OUTPUT_PATH = path.join(__dirname, 'output.wav');

// ずんだもん台本
const SCRIPT_TEXT = `やあ、ガジェットハンターのずんだもんなのだ。今日はAMDとNVIDIAのアップスケーリング戦争について話すわけ。AMDのFSR 4、約6年かけてやっとDLSSに追いついたのだ。でも画質はDLSS 3とDLSS 4の中間くらい。つまり、2年遅れってわけ。そしてNVIDIAはCES 2026でDLSS 4.5を発表。Transformer技術の第2世代で、さらに画質アップなのだ。AMDが必死に追いかけてる間に、NVIDIAはもう次のステージに行ってるわけ。まるで100メートル走でゴールしたと思ったら、コースが200メートルに変わってたみたいな話なのだ。まあ、NVIDIAのGPU、性能は凄いけど値段も凄いからね。AMDさん、FSR 5はよ。`;

function httpRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, body, headers: res.headers });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body.toString('utf8').substring(0, 500)}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Request timeout (60s). Check if VOICEVOX Desktop is running.'));
        });
        if (postData) req.write(postData);
        req.end();
    });
}

async function synthesize() {
    console.log('=== VOICEVOX Audio Synthesizer ===');
    console.log(`Speaker: ずんだもん (ID: ${SPEAKER_ID})`);
    console.log(`Script length: ${SCRIPT_TEXT.length} chars\n`);

    // Step 1: Create audio query
    console.log('📝 Step 1: Creating audio query...');
    const queryParams = `text=${encodeURIComponent(SCRIPT_TEXT)}&speaker=${SPEAKER_ID}`;

    const queryResult = await httpRequest({
        hostname: VOICEVOX_HOST,
        port: VOICEVOX_PORT,
        path: `/audio_query?${queryParams}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    const audioQuery = JSON.parse(queryResult.body.toString('utf8'));

    // Speed up speech tempo (user request: もう少しテンポ速く)
    audioQuery.speedScale = 1.3;
    console.log(`  ✅ Audio query created (speedScale: ${audioQuery.speedScale}, pitchScale: ${audioQuery.pitchScale})`);

    // Step 2: Synthesize audio
    console.log('🔊 Step 2: Synthesizing audio...');
    const synthesisResult = await httpRequest({
        hostname: VOICEVOX_HOST,
        port: VOICEVOX_PORT,
        path: `/synthesis?speaker=${SPEAKER_ID}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify(audioQuery));

    // Step 3: Save WAV file
    fs.writeFileSync(OUTPUT_PATH, synthesisResult.body);
    const fileSize = fs.statSync(OUTPUT_PATH).size;

    console.log(`  ✅ Audio saved: output.wav`);
    console.log(`  📊 File size: ${(fileSize / 1024).toFixed(1)} KB`);

    // Validation
    if (fileSize === 0) {
        console.error('  ❌ VALIDATION FAILED: output.wav is 0 bytes!');
        process.exit(1);
    } else {
        console.log('  ✅ VALIDATION PASSED: file size > 0 bytes');
    }

    console.log('\n✅ Audio synthesis complete!');
}

synthesize().catch((err) => {
    console.error('❌ Error:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
        console.error('\n⚠️ VOICEVOX Desktop is not running!');
        console.error('   Please launch VOICEVOX Desktop app, then try again.');
    }
    process.exit(1);
});
