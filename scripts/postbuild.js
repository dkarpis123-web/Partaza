// After `expo export`: tell the browser up front which code files the first screen needs,
// so they download in parallel with the main file instead of one after another.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const dir = path.join(dist, '_expo', 'static', 'js', 'web');
const html = path.join(dist, 'index.html');
if (!fs.existsSync(dir) || !fs.existsSync(html)) {
  console.log('postbuild: nothing to do');
  process.exit(0);
}
const first = fs.readdirSync(dir).filter((f) => /^(_layout|index)-[0-9a-f]+\.js$/.test(f));
const links = first.map((f) => `    <link rel="preload" as="script" href="/_expo/static/js/web/${f}" />`).join('\n');
let page = fs.readFileSync(html, 'utf8');
if (!page.includes('rel="preload" as="script"')) {
  page = page.replace('</head>', `${links}\n  </head>`);
  fs.writeFileSync(html, page);
}
console.log(`postbuild: preloading ${first.length} files`);
