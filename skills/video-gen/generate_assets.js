/**
 * Generate placeholder assets (character.png + bg.jpg)
 * Uses pure Node.js to create simple colored rectangles.
 * SKILL.md says character.png quality doesn't matter.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const WORK_DIR = __dirname;

function generateBg() {
    // Use FFmpeg to generate a 1920x1080 dark gradient background
    const output = path.join(WORK_DIR, 'bg.jpg');
    const cmd = [
        `"${ffmpegPath}"`,
        `-f lavfi -i "color=c=0x0a0a14:s=1920x1080:d=1,format=rgb24"`,
        `-f lavfi -i "color=c=0x00ff41:s=1920x1080:d=1,format=rgb24"`,
        `-filter_complex "[0:v][1:v]blend=all_mode=addition:all_opacity=0.05"`,
        `-frames:v 1 -y "${output}"`,
    ].join(' ');

    try {
        execSync(cmd, { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
        console.log(`✅ bg.jpg created (${(fs.statSync(output).size / 1024).toFixed(1)} KB)`);
    } catch (e) {
        // Fallback: simple solid dark image
        console.log('  Fallback: simple dark bg');
        const fallbackCmd = `"${ffmpegPath}" -f lavfi -i "color=c=0x0a0a1a:s=1920x1080:d=1" -frames:v 1 -y "${output}"`;
        execSync(fallbackCmd, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
        console.log(`✅ bg.jpg created (fallback) (${(fs.statSync(output).size / 1024).toFixed(1)} KB)`);
    }
}

function generateCharacter() {
    // Use FFmpeg to generate a simple green character placeholder (500x800 green-ish silhouette)
    const output = path.join(WORK_DIR, 'character.png');
    // Create a simple colored rectangle as placeholder - SKILL.md says quality doesn't matter
    const cmd = [
        `"${ffmpegPath}"`,
        `-f lavfi -i "color=c=0x00cc33:s=300x500:d=1,format=rgba"`,
        `-frames:v 1 -y "${output}"`,
    ].join(' ');

    try {
        execSync(cmd, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
        console.log(`✅ character.png created (${(fs.statSync(output).size / 1024).toFixed(1)} KB)`);
    } catch (e) {
        console.error('❌ Failed to create character.png:', e.message);
        process.exit(1);
    }
}

console.log('=== Asset Generator ===');
generateBg();
generateCharacter();
console.log('\n✅ All assets generated.');
