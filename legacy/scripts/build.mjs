import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const readJson = async (p, fallback) => {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
};

const site = await readJson(path.join(ROOT, 'data', 'site.json'), {
  name: 'אתר הנצחה',
  tagline: 'לאלו שנלקחו מאיתנו • 7.10.2023',
  description: 'אתר הנצחה לאלו שנלקחו מאיתנו בשביעי באוקטובר 2023',
  url: ''
});

const people = await readJson(path.join(ROOT, 'data', 'people.json'), []);

const layout = await fs.readFile(path.join(SRC, 'layout.html'), 'utf8');

const placeSlug = (place) => {
  const map = {
    'ארז':'arez',
    'גבים':'gavim',
    'יכיני':'yakhini',
    'כפר עזה':'kfar-aza',
    'נחל עוז':'nahal-oz',
    'ניר עם':'nir-am'
  };
  return map[place] || encodeURIComponent(place);
};

const uniq = (arr) => Array.from(new Set(arr));

const ensureDir = async (p) => {
  await fs.mkdir(p, { recursive: true });
};

const copyDir = async (srcDir, dstDir) => {
  await ensureDir(dstDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  await Promise.all(entries.map(async (e) => {
    const s = path.join(srcDir, e.name);
    const d = path.join(dstDir, e.name);
    if (e.isDirectory()) return copyDir(s, d);
    if (e.isFile()) return fs.copyFile(s, d);
  }));
};

const extractMain = async (filePath) => {
  const html = await fs.readFile(filePath, 'utf8');
  const m = html.match(/<main[^>]*id="main"[^>]*>[\s\S]*?<\/main>/i);
  if (!m) throw new Error(`Could not find <main id="main"> in ${filePath}`);
  return m[0];
};

const absOrRel = (p, depth) => {
  // p is root-relative path like '/assets/x.png'
  if (site.url) return site.url.replace(/\/$/, '') + p;
  // relative
  return (depth === 0 ? p.slice(1) : '../' + p.slice(1));
};

const pageUrl = (outPath) => {
  // outPath is like 'index.html' or 'p/p001.html'
  const rel = outPath.replace(/^\//,'');
  if (site.url) return site.url.replace(/\/$/, '') + '/' + rel;
  return rel;
};

const render = (tpl, vars) => {
  let out = tpl;
  for (const [k,v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ''));
  }
  return out;
};

const navClass = (active, key) => (active === key ? 'pill is-active' : 'pill');

const writePage = async ({ outPath, title, description, ogTitle, ogDescription, ogImagePath, active, baseDepth, headExtra, scriptsHead, mainHtml }) => {
  const depth = baseDepth ?? 0;
  const baseTag = depth ? `<base href="${'../'.repeat(depth)}">` : '';

  const ogImage = absOrRel(ogImagePath || '/assets/default-share-image.png', depth);
  const ogUrl = pageUrl(outPath);
  const canonical = ogUrl;

  const html = render(layout, {
    BASE_TAG: baseTag,
    TITLE: title,
    DESCRIPTION: description,
    SITE_NAME: site.name,
    SITE_TAGLINE: site.tagline,
    OG_TITLE: ogTitle || title,
    OG_DESCRIPTION: ogDescription || description,
    OG_IMAGE: ogImage,
    OG_URL: ogUrl,
    CANONICAL: canonical,
    NAV_FIELD: navClass(active,'field'),
    NAV_PEOPLE: navClass(active,'people'),
    NAV_PLACES: navClass(active,'places'),
    NAV_ABOUT: navClass(active,'about'),
    HEAD_EXTRA: headExtra || '',
    SCRIPTS_HEAD: scriptsHead || '',
    MAIN: mainHtml
  });

  const fullOut = path.join(DIST, outPath);
  await ensureDir(path.dirname(fullOut));
  await fs.writeFile(fullOut, html, 'utf8');
};

// Clean dist
await fs.rm(DIST, { recursive: true, force: true });
await ensureDir(DIST);

// Static assets/data
await copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
await copyDir(path.join(ROOT, 'data'), path.join(DIST, 'data'));
await fs.copyFile(path.join(ROOT, 'robots.txt'), path.join(DIST, 'robots.txt'));

// Root pages (reuse existing main blocks so UI stays identical)
const rootPages = [
  { file: 'index.html', active: 'field', title: 'אתר הנצחה | שדה אורות', description: site.description },
  { file: 'people.html', active: 'people', title: 'אתר הנצחה | כל האנשים', description: site.description },
  { file: 'places.html', active: 'places', title: 'אתר הנצחה | יישובים', description: site.description },
  { file: 'about.html', active: 'about', title: 'אתר הנצחה | אודות', description: site.description },
  { file: 'person.html', active: 'people', title: 'אתר הנצחה | ספר זיכרון', description: 'אתר הנצחה – ספר זיכרון.' },
  { file: 'place.html', active: 'places', title: 'אתר הנצחה | דף יישוב', description: 'אתר הנצחה – דף יישוב.' }
];

for (const p of rootPages) {
  const main = await extractMain(path.join(ROOT, p.file));

  const needsSupabase = p.file === 'person.html';
  const scriptsHead = [
    needsSupabase ? '<!-- Supabase (אופציונלי) -->\n  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script defer src="assets/backend-config.js"></script>' : '',
    '<script defer src="assets/app.js"></script>\n  <script defer src="assets/premium.js"></script>'
  ].filter(Boolean).join('\n  ');

  await writePage({
    outPath: p.file,
    title: p.title,
    description: p.description,
    ogTitle: p.title,
    ogDescription: p.description,
    active: p.active,
    baseDepth: 0,
    headExtra: '',
    scriptsHead,
    mainHtml: main
  });
}

// Person pages (/p/*)
const personMain = await extractMain(path.join(ROOT, 'person.html'));
for (const person of people) {
  const name = person?.name || 'ספר זיכרון';
  const title = `אתר הנצחה | ${name}`;
  const description = `עמוד זיכרון והדלקת נר לזכר ${name}.`;

  const headExtra = `<script>\n    window.PERSON_ID = "${String(person.id).replaceAll('"','\\"')}";\n  </script>`;

  const scriptsHead = [
    '<!-- Supabase (אופציונלי) -->\n  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script defer src="assets/backend-config.js"></script>',
    '<script defer src="assets/app.js"></script>\n  <script defer src="assets/premium.js"></script>'
  ].join('\n  ');

  await writePage({
    outPath: `p/${person.id}.html`,
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    active: 'people',
    baseDepth: 1,
    headExtra,
    scriptsHead,
    mainHtml: personMain
  });
}

// Place pages (/place/*)
const placeMain = await extractMain(path.join(ROOT, 'place.html'));
const places = uniq(people.map(p => p.place)).sort((a,b)=>String(a).localeCompare(String(b),'he'));
for (const pl of places) {
  const title = `אתר הנצחה | ${pl}`;
  const description = `עמוד יישוב שמרכז יחד את דפי הזיכרון של קהילת ${pl}.`;
  const headExtra = `<script>\n    window.PLACE_NAME = "${String(pl).replaceAll('"','\\"')}";\n  </script>`;
  const scriptsHead = '<script defer src="assets/app.js"></script>\n  <script defer src="assets/premium.js"></script>';
  await writePage({
    outPath: `place/${placeSlug(pl)}.html`,
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    active: 'places',
    baseDepth: 1,
    headExtra,
    scriptsHead,
    mainHtml: placeMain
  });
}

// Sitemap (relative URLs; if site.url is set, you can regenerate with absolute <loc>)
const urls = [
  'index.html','people.html','places.html','about.html',
  ...places.map(pl=>`place/${placeSlug(pl)}.html`),
  ...people.map(p=>`p/${p.id}.html`)
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
urls.map(u => `  <url>\n    <loc>${site.url ? site.url.replace(/\/$/,'') + '/' + u : u}</loc>\n  </url>`).join('\n') +
`\n</urlset>\n`;
await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');

console.log(`Built ${urls.length} URLs into ${DIST}`);
