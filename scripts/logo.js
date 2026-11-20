const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path');
const font = fs.readFileSync('node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2').toString('base64');
const A = '/home/claude/partaza/assets', P = '/home/claude/partaza/public';
// mark: a gear wheel (the part) with the letter P in its bore
const gear = (teeth, rOut, rIn) => {
  const pts = []; const step = (2 * Math.PI) / teeth;
  for (let i = 0; i < teeth; i++) {
    const c = i * step - Math.PI / 2;
    [[-0.30, rIn], [-0.19, rOut], [0.19, rOut], [0.30, rIn]].forEach(([o, r]) => pts.push(`${(512 + r * Math.cos(c + o * step)).toFixed(1)},${(512 + r * Math.sin(c + o * step)).toFixed(1)}`));
  }
  return pts.join(' ');
};
const mark = (nut, letter, bore) => {
  const flat = nut === '#FFFFFF';
  const pts = gear(8, 440, 345);
  if (flat) return `
  <polygon points="${pts}" fill="${nut}" stroke="${nut}" stroke-width="44" stroke-linejoin="round"/>
  <circle cx="512" cy="512" r="238" fill="#000"/>`;
  // 3D: the wheel is extruded down and to the right, lit from the top left
  const depth = 46;
  let side = '';
  for (let i = depth; i >= 1; i -= 2) side += `<polygon points="${pts}" transform="translate(${(i * 0.55).toFixed(1)} ${i})" fill="#9A3A08" stroke="#9A3A08" stroke-width="44" stroke-linejoin="round"/>`;
  return `
  <defs>
    <linearGradient id="face" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#FFA35C"/><stop offset="0.45" stop-color="${nut}"/><stop offset="1" stop-color="#D9530C"/></linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A2D05"/><stop offset="1" stop-color="#C24A0B"/></linearGradient>
    <radialGradient id="hole" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#262B32"/><stop offset="1" stop-color="${bore}"/></radialGradient>
    <clipPath id="boreclip"><circle cx="512" cy="512" r="238"/></clipPath>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <ellipse cx="540" cy="990" rx="400" ry="26" fill="#000" opacity="0.45" filter="url(#soft)"/>
  ${side}
  <polygon points="${pts}" fill="url(#face)" stroke="url(#face)" stroke-width="44" stroke-linejoin="round"/>
  <polygon points="${gear(8, 440, 345)}" fill="none" stroke="#FFD2AE" stroke-opacity="0.55" stroke-width="5" stroke-linejoin="round" transform="translate(-6 -8)" clip-path="none"/>
  <circle cx="512" cy="512" r="238" fill="url(#wall)"/>
  <g clip-path="url(#boreclip)"><circle cx="${512 + depth * 0.55}" cy="${512 + depth}" r="238" fill="url(#hole)"/></g>
  <circle cx="512" cy="512" r="238" fill="none" stroke="#FFC79B" stroke-opacity="0.5" stroke-width="5"/>
  <text x="${538 + 6}" y="${662 + 8}" text-anchor="middle" font-family="SG" font-weight="700" font-size="340" fill="#000" opacity="0.5">P</text>
  <text x="538" y="662" text-anchor="middle" font-family="SG" font-weight="700" font-size="340" fill="${letter}">P</text>`;
};
const svg = (bg, nut, letter, bore, scale, radius) => `<html><head><style>@font-face{font-family:SG;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:700}html,body{margin:0;background:transparent}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg === 'none' ? '' : `<rect width="1024" height="1024" rx="${radius}" fill="${bg}"/>`}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${mark(nut, letter, bore)}</g>
</svg></body></html>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  const shot = async (html, file, px = 1024) => { await p.setViewport({ width: 1024, height: 1024, deviceScaleFactor: px / 1024 }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: file, omitBackground: true }); };
  const INK = '#15181C', OR = '#F26A1B', W = '#FFFFFF';
  await shot(svg(INK, OR, W, INK, 0.74, 0), path.join(A, 'icon.png'));
  await shot(svg('none', OR, W, INK, 0.5, 0), path.join(A, 'android-icon-foreground.png'));
  await shot(svg('none', W, W, 'transparent', 0.5, 0), path.join(A, 'android-icon-monochrome.png'));
  await shot(svg('none', OR, W, INK, 0.6, 0), path.join(A, 'splash-icon.png'));
  await shot(svg(INK, OR, W, INK, 0.74, 230), path.join(A, 'logo-mark.png'), 192);
  await shot(svg(INK, OR, W, INK, 0.74, 230), path.join(A, 'favicon.png'), 48);
  await shot(svg(INK, OR, W, INK, 0.74, 0), path.join(P, 'logo192.png'), 192);
  await shot(svg(INK, OR, W, INK, 0.74, 0), path.join(P, 'logo512.png'), 512);
  await shot(svg(INK, OR, W, INK, 0.74, 0), path.join(P, 'apple-touch-icon.png'), 180);
  await b.close();
})();
