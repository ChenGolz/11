import fs from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');

async function walk(dir){
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

function minifyHtml(html){
  // Conservative minifier:
  // - remove most HTML comments
  // - collapse whitespace between tags
  // - trim leading/trailing whitespace
  // (Astro already outputs fairly small HTML; this is a final squeeze.)
  return html
    .replace(/<!--(?!\s*\[if)[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

try{
  const files = await walk(DIST);
  await Promise.all(files.map(async (f) => {
    const html = await fs.readFile(f, 'utf8');
    const out = minifyHtml(html);
    await fs.writeFile(f, out, 'utf8');
  }));
  console.log(`Minified ${files.length} HTML files in ${DIST}`);
}catch(err){
  // Don't fail the build if dist doesn't exist.
  console.warn('HTML minify skipped:', err?.message || err);
}
