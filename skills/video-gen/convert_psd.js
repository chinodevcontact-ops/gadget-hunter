/**
 * Convert ずんだもん PSD to transparent PNG
 * Uses ag-psd to parse PSD and outputs flattened composite as PNG
 */

const { readPsd } = require('ag-psd');
const fs = require('fs');
const path = require('path');

// ag-psd needs canvas for pixel data - we'll use a raw approach
// Since ag-psd v15+ can read without canvas into raw data, we use that
const { createCanvas } = (() => {
    try {
        return require('canvas');
    } catch {
        return { createCanvas: null };
    }
})();

const PSD_DIR = path.join(__dirname, '..', '..', 'tatie', 'ずんだもん立ち絵素材V3.2', 'ずんだもん立ち絵素材V3.2');
const OUTPUT = path.join(__dirname, 'character.png');

// List available PSD files
const psdFiles = fs.readdirSync(PSD_DIR).filter(f => f.endsWith('.psd'));
console.log('Available PSD files:');
psdFiles.forEach(f => {
    const stats = fs.statSync(path.join(PSD_DIR, f));
    console.log(`  ${f} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
});

// Use the basic version (smallest, most likely to parse well)
const targetPsd = psdFiles.find(f => f.includes('基本版')) || psdFiles[0];
console.log(`\nUsing: ${targetPsd}`);

const psdPath = path.join(PSD_DIR, targetPsd);
const buffer = fs.readFileSync(psdPath);

try {
    const psd = readPsd(buffer);

    console.log(`PSD size: ${psd.width}x${psd.height}`);
    console.log(`Layers: ${psd.children ? psd.children.length : 0}`);

    if (psd.canvas) {
        // ag-psd has canvas support - write directly
        const pngBuffer = psd.canvas.toBuffer('image/png');
        fs.writeFileSync(OUTPUT, pngBuffer);
        console.log(`\n✅ character.png saved (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)`);
    } else if (psd.imageData) {
        // Raw image data available - convert via ffmpeg
        console.log('No canvas support, using FFmpeg to convert raw data...');
        const ffmpegPath = require('ffmpeg-static');
        const { execSync } = require('child_process');

        // Write raw RGBA data to temp file
        const rawPath = path.join(__dirname, '_temp_raw.rgba');
        const rawBuffer = Buffer.from(psd.imageData);
        fs.writeFileSync(rawPath, rawBuffer);

        const cmd = `"${ffmpegPath}" -f rawvideo -pixel_format rgba -video_size ${psd.width}x${psd.height} -i "${rawPath}" -frames:v 1 -y "${OUTPUT}"`;
        execSync(cmd, { stdio: 'pipe' });

        // Clean up
        fs.unlinkSync(rawPath);
        console.log(`\n✅ character.png saved (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)`);
    } else {
        console.error('❌ ag-psd could not extract pixel data from this PSD.');
        console.log('   Try installing canvas: npm install canvas');
        console.log('   Or use PSDTool (https://oov.github.io/psdtool/) to export manually.');
        process.exit(1);
    }
} catch (err) {
    console.error('❌ PSD parse error:', err.message);
    console.log('\n💡 Alternative: export the PSD manually using PSDTool and save as character.png');
    process.exit(1);
}
