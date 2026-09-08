const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
// Only clear this project's generated build directory.
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Unsafe output directory');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of ['index.html', 'style.css', 'game-core.js', 'game-art.js', 'game.js']) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
fs.mkdirSync(path.join(out, 'assets/fonts'), { recursive: true });
for (const asset of ['rocket-duo.png', 'fonts/barlow-condensed-800.ttf', 'fonts/OFL.txt']) {
  fs.copyFileSync(path.join(root, 'assets', asset), path.join(out, 'assets', asset));
}
console.log('Built static game in dist/');
