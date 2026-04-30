/**
 * Generate mouth-open and mouth-closed character variants
 * 
 * Since PSD layer extraction fails (memory), we use FFmpeg:
 * 1. Base character = FFmpeg PSD flattened export
 * 2. Mouth-closed = same as base (default PSD expression)
 * 3. Mouth-open = base with a small drawn oval overlay at mouth position
 *    to simulate an open mouth
 * 
 * The mouth position for ずんだもん is approximately:
 * PSD is 1082x1594, mouth is around center-x, ~60% down from top
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const WORK_DIR = __dirname;
const PSD_PATH = 'c:/gadget-hunter/tatie/ずんだもん立ち絵素材V3.2/ずんだもん立ち絵素材V3.2/ずんだもん立ち絵素材V3.2_基本版.psd';
const BASE_PATH = path.join(WORK_DIR, 'character.png');
const CLOSED_PATH = path.join(WORK_DIR, 'char_mouth_closed.png');
const OPEN_PATH = path.join(WORK_DIR, 'char_mouth_open.png');

console.log('=== Character Mouth Variant Generator ===\n');

// Step 1: Export flattened PSD to character.png (high quality)
console.log('📷 Exporting flattened PSD...');
try {
    execSync(
        `"${ffmpegPath}" -i "${PSD_PATH}" -frames:v 1 -y "${BASE_PATH}"`,
        { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    );
} catch (e) {
    // FFmpeg often returns non-zero but still creates the file
}

if (fs.existsSync(BASE_PATH) && fs.statSync(BASE_PATH).size > 0) {
    console.log(`  ✅ character.png (${(fs.statSync(BASE_PATH).size / 1024).toFixed(0)} KB)`);
} else {
    console.error('  ❌ PSD export failed');
    process.exit(1);
}

// Step 2: Copy base as mouth-closed
console.log('\n🔇 Creating mouth-closed variant...');
fs.copyFileSync(BASE_PATH, CLOSED_PATH);
console.log(`  ✅ char_mouth_closed.png`);

// Step 3: Create mouth-open variant
// Draw a small dark oval at the mouth position to simulate open mouth
// ずんだもん mouth is approximately at (540, 930) in the 1082x1594 PSD
// The oval should be roughly 60x35 pixels
console.log('\n🔊 Creating mouth-open variant...');
try {
    const cmd = [
        `"${ffmpegPath}"`,
        `-i "${BASE_PATH}"`,
        `-filter_complex`,
        // Draw a dark ellipse at mouth position to simulate open mouth
        // Position: roughly center-x=540, y=930 for ずんだもん基本版
        `"drawbox=x=510:y=920:w=60:h=30:color=black@0.7:t=fill,drawbox=x=515:y=923:w=50:h=24:color=#3d1a1a@0.8:t=fill"`,
        `-frames:v 1 -y "${OPEN_PATH}"`,
    ].join(' ');

    execSync(cmd, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    console.log(`  ✅ char_mouth_open.png (${(fs.statSync(OPEN_PATH).size / 1024).toFixed(0)} KB)`);
} catch (e) {
    console.error('  ⚠️ Mouth overlay failed, using brightness shift fallback');
    const cmd = [
        `"${ffmpegPath}"`,
        `-i "${BASE_PATH}"`,
        `-filter_complex "[0:v]eq=brightness=0.04:contrast=1.02[out]"`,
        `-map "[out]" -frames:v 1 -y "${OPEN_PATH}"`,
    ].join(' ');
    execSync(cmd, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    console.log(`  ✅ char_mouth_open.png (brightness fallback)`);
}

console.log('\n✅ All mouth variants ready!');
console.log(`  Closed: ${CLOSED_PATH}`);
console.log(`  Open: ${OPEN_PATH}`);
