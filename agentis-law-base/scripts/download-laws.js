#!/usr/bin/env node
/**
 * AGENTIS Law Database — Завантажувач законів v3
 * 
 * Завантажує тексти законів ТА підзаконних НПА з офіційного сайту ВРУ:
 *   https://zakon.rada.gov.ua/laws/file/{nreg}  — прямий HTM файл
 * 
 * Джерела:
 *   laws-registry.js    — 200 законів / кодексів
 *   sublaws-registry.js — 35 підзаконних НПА (порядки, типові договори, ліцензійні умови)
 * 
 * Запуск:
 *   node scripts/download-laws.js                    — всі enabled (закони + підзаконні)
 *   node scripts/download-laws.js --laws-only        — тільки закони
 *   node scripts/download-laws.js --sublaws-only     — тільки підзаконні НПА
 *   node scripts/download-laws.js kupap.txt          — тільки один файл
 *   node scripts/download-laws.js --list             — показати що є/немає
 *   node scripts/download-laws.js --force            — перезаписати існуючі
 *   node scripts/download-laws.js --stats            — статистика бази
 * 
 * Вихід: data/raw/<filename> (чистий текст, UTF-8)
 */

const fs = require('fs');
const path = require('path');
const { getEnabledLaws, getLawByFilename, LAWS_REGISTRY } = require('./laws-registry');
const { getEnabledSublaws, getSublawByFilename, SUBLAWS_REGISTRY } = require('./sublaws-registry');

// ═══════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const USER_AGENT = 'Mozilla/5.0 (compatible; AGENTIS-LawBot/3.0; legal AI platform)';

// Delay between requests (be polite to government servers)
const DELAY_MS = 3000;

if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

// ═══════════════════════════════════════
//  COMBINED REGISTRY ACCESS
// ═══════════════════════════════════════

/** Get all enabled items from both registries */
function getAllEnabled() {
  return [...getEnabledLaws(), ...getEnabledSublaws()];
}

/** Get all items from both registries */
function getAllRegistry() {
  return [...LAWS_REGISTRY, ...SUBLAWS_REGISTRY];
}

/** Find item by filename in either registry */
function findByFilename(filename) {
  return getLawByFilename(filename) || getSublawByFilename(filename) || null;
}

/** Determine source type for display */
function getSourceLabel(item) {
  // sublaws have 'type' field (order, resolution, standard, law)
  // laws from LAWS_REGISTRY don't have 'type' field
  if (item.type) {
    const labels = {
      'order': 'Наказ',
      'resolution': 'Постанова',
      'standard': 'Стандарт',
      'law': 'Закон (в.с.)',
    };
    return labels[item.type] || 'НПА';
  }
  return 'Закон';
}

// ═══════════════════════════════════════
//  EXTRACT nreg FROM sourceUrl
// ═══════════════════════════════════════

/**
 * Extract nreg from zakon.rada.gov.ua URL.
 * https://zakon.rada.gov.ua/laws/show/435-15  -> 435-15
 * https://zakon.rada.gov.ua/laws/show/85/96-вр -> 85/96-вр
 * https://zakon.rada.gov.ua/go/z0282-12       -> z0282-12
 */
function extractNreg(sourceUrl) {
  // Handle /go/ URLs (redirect format)
  const goMatch = sourceUrl.match(/\/go\/(.+?)(?:#|$)/);
  if (goMatch) return goMatch[1];
  
  // Handle /laws/show/ URLs
  const showMatch = sourceUrl.match(/\/laws\/show\/(.+?)(?:#|$)/);
  if (showMatch) return showMatch[1];
  
  return null;
}

// ═══════════════════════════════════════
//  HTML -> CLEAN TEXT
// ═══════════════════════════════════════

function htmlToText(html) {
  let text = html;

  // Remove entire blocks
  text = text.replace(/<head[\s\S]*?<\/head>/gi, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');

  // Block elements -> newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, '\t');

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  const entities = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&mdash;': '—', '&ndash;': '–',
    '&laquo;': '«', '&raquo;': '»', '&oacute;': 'o',
    '&sect;': '§', '&deg;': '°', '&copy;': '©',
    '&times;': '×', '&minus;': '−', '&hellip;': '…',
  };
  for (const [entity, char] of Object.entries(entities)) {
    text = text.replaceAll(entity, char);
  }
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Clean whitespace
  text = text.replace(/\t+/g, ' ');
  text = text.replace(/ {2,}/g, ' ');
  text = text.replace(/\n /g, '\n');
  text = text.replace(/ \n/g, '\n');
  text = text.replace(/\n{4,}/g, '\n\n\n');

  return text.trim();
}

// ═══════════════════════════════════════
//  CONTENT QUALITY CHECK
// ═══════════════════════════════════════

/**
 * Check if downloaded content has real substance.
 * Laws have "Стаття X", but підзаконні НПА may have:
 *   - "пункт X" / "X." numbered items
 *   - "Глава X" / "Розділ X"
 *   - "ЗАТВЕРДЖЕНО" / "ПОРЯДОК" / "ТИПОВИЙ"
 */
function assessContent(html, item) {
  const hasArticles = /Стаття\s+\d+/i.test(html);
  const hasPunkty = /^\s*\d+\.\s+/m.test(html);
  const hasChapters = /(?:Глава|Розділ|РОЗДІЛ)\s+\d+/i.test(html);
  const hasApproved = /ЗАТВЕРДЖЕНО|ПОРЯДОК|ТИПОВ|ЛІЦЕНЗІЙНІ|ІНСТРУКЦІЯ|ПРАВИЛА/i.test(html);
  const hasResolution = /КАБІНЕТ МІНІСТРІВ|ПОСТАНОВА|НАКАЗ|МІНІСТЕРСТВО/i.test(html);
  const hasDstu = /ДСТУ|ГОСТ|СТАНДАРТ/i.test(html);
  const hasContractTerms = /СТОРОНИ|ПРЕДМЕТ ДОГОВОРУ|ПРАВА ТА ОБОВ|ВІДПОВІДАЛЬНІСТЬ СТОРІН/i.test(html);
  const isSublaw = !!item.type;
  
  // For laws: require articles or large size
  if (!isSublaw) {
    return hasArticles || html.length > 50000;
  }
  
  // For sublaws: very flexible — any structural marker or >8KB
  return hasArticles || hasPunkty || hasChapters || hasApproved 
    || hasResolution || hasDstu || hasContractTerms || html.length > 8000;
}

/**
 * Count structural elements for stats display.
 */
function countElements(text) {
  const articles = (text.match(/Стаття\s+\d+/g) || []).length;
  const punkty = (text.match(/^\s*\d+\.\s+/gm) || []).length;
  const chapters = (text.match(/(?:Глава|Розділ)\s+\d+/gi) || []).length;
  
  if (articles > 0) return { count: articles, label: 'ст.' };
  if (punkty > 5) return { count: punkty, label: 'п.' };
  if (chapters > 0) return { count: chapters, label: 'гл.' };
  return { count: 0, label: 'ст.' };
}

// ═══════════════════════════════════════
//  DOWNLOAD STRATEGIES
// ═══════════════════════════════════════

/**
 * Try multiple URL patterns to download a law/sublaw.
 * Returns { html, url } on success.
 * 
 * v2 (Feb 15, 2026):
 *   - URL-encodes Cyrillic characters in nreg (55-2018-п → 55-2018-%D0%BF)
 *   - 5 strategies instead of 3
 *   - For КМУ постанови: also tries fetching appendix (основний текст часто там)
 *   - Relaxed content check for sublaws
 */
async function tryDownload(nreg, item) {
  const isSublaw = !!item.type;
  
  // URL-encode Cyrillic characters in nreg
  const nregEncoded = nreg.replace(/[^\x00-\x7F]/g, ch => encodeURIComponent(ch));
  const hasCyrillic = nreg !== nregEncoded;
  
  // Build strategy list
  const urls = [];
  
  // Strategy 1: Direct file download (HTM)
  urls.push({ url: `https://zakon.rada.gov.ua/laws/file/${nregEncoded}`, label: 'file (encoded)' });
  
  // Strategy 2: Conv/print — consolidated text version (works best for НПА!)
  urls.push({ url: `https://zakon.rada.gov.ua/laws/show/${nregEncoded}/conv/print`, label: 'conv/print' });
  
  // Strategy 3: Print version — server-rendered
  urls.push({ url: `https://zakon.rada.gov.ua/laws/show/${nregEncoded}/print`, label: 'print' });
  
  // Strategy 4: Regular page (may have JS-loaded content but often works)
  urls.push({ url: `https://zakon.rada.gov.ua/laws/show/${nregEncoded}`, label: 'show' });
  
  // Strategy 5: Raw Cyrillic URL (some servers handle it differently)
  if (hasCyrillic) {
    urls.push({ url: `https://zakon.rada.gov.ua/laws/show/${nreg}/conv/print`, label: 'conv/print (raw cyrillic)' });
    urls.push({ url: `https://zakon.rada.gov.ua/laws/file/${nreg}`, label: 'file (raw cyrillic)' });
    urls.push({ url: `https://zakon.rada.gov.ua/laws/show/${nreg}/print`, label: 'print (raw cyrillic)' });
  }

  for (const { url, label } of urls) {
    try {
      process.stdout.write(`   🌐 [${label}] ${url.substring(0, 70)}... `);

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'uk-UA,uk;q=0.9',
          'Accept-Encoding': 'identity',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        console.log(`❌ ${response.status}`);
        continue;
      }

      const html = await response.text();
      const sizeKB = Math.round(html.length / 1024);
      
      if (assessContent(html, item)) {
        const elements = countElements(html);
        const hasText = elements.count > 0 ? `${elements.count} ${elements.label}` : `${sizeKB}KB`;
        console.log(`✅ ${sizeKB} KB (${hasText})`);
        return { html, url };
      } else {
        console.log(`⚠️ ${sizeKB} KB — тільки оболонка`);
        
        // For sublaws: if we got >5KB, try to extract what we can
        if (isSublaw && html.length > 5000) {
          const text = htmlToText(html);
          // Some НПА are short but valid (e.g., типовий договір = 3-5 pages)
          if (text.length > 2000) {
            console.log(`   ↳ Спроба витягти текст: ${Math.round(text.length / 1024)} KB clean`);
            return { html, url };
          }
        }
        continue;
      }

    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        console.log('⏱️ timeout');
      } else {
        console.log(`❌ ${err.message.substring(0, 60)}`);
      }
      continue;
    }
  }

  // ── LAST RESORT for КМУ постанови: try appendix URLs ──
  // Постанови КМУ часто мають основний текст (ПОРЯДОК, ПРАВИЛА, etc.) 
  // як "Додаток" з окремим URL: /laws/show/{nreg}/paran{N}
  if (isSublaw && (nreg.includes('-п') || item.type === 'resolution')) {
    console.log(`   📎 Спроба завантажити додаток (Постанова КМУ)...`);
    
    // First fetch the main page to find appendix links
    try {
      const mainUrl = `https://zakon.rada.gov.ua/laws/show/${nregEncoded}`;
      const mainResp = await fetch(mainUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'uk-UA' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      
      if (mainResp.ok) {
        const mainHtml = await mainResp.text();
        
        // Look for appendix links: /laws/show/{nreg}/paran{N} or #n{N}
        const appendixMatches = mainHtml.match(/\/laws\/show\/[^"'\s]+\/paran\d+/g) || [];
        const uniqueAppendixes = [...new Set(appendixMatches)].slice(0, 3);
        
        if (uniqueAppendixes.length > 0) {
          // Try to fetch the first appendix (usually the main ПОРЯДОК/ПРАВИЛА)
          for (const appendixPath of uniqueAppendixes) {
            const appendixUrl = `https://zakon.rada.gov.ua${appendixPath}`;
            process.stdout.write(`   🌐 [appendix] ${appendixUrl.substring(0, 70)}... `);
            
            try {
              const appResp = await fetch(appendixUrl, {
                headers: { 'User-Agent': USER_AGENT },
                redirect: 'follow',
                signal: AbortSignal.timeout(30000),
              });
              
              if (appResp.ok) {
                const appHtml = await appResp.text();
                if (assessContent(appHtml, item) || appHtml.length > 10000) {
                  const elements = countElements(appHtml);
                  console.log(`✅ ${Math.round(appHtml.length / 1024)} KB (${elements.count} ${elements.label})`);
                  // Combine main resolution text + appendix
                  const combined = mainHtml + '\n\n<!-- ДОДАТОК -->\n\n' + appHtml;
                  return { html: combined, url: appendixUrl };
                } else {
                  console.log(`⚠️ малий`);
                }
              } else {
                console.log(`❌ ${appResp.status}`);
              }
            } catch (e) {
              console.log(`❌ ${e.message.substring(0, 40)}`);
            }
          }
        }
        
        // No appendix links found? Try print of the full document with #Text anchor
        const printTextUrl = `https://zakon.rada.gov.ua/laws/show/${nregEncoded}/print`;
        process.stdout.write(`   🌐 [full print] ${printTextUrl.substring(0, 70)}... `);
        try {
          const printResp = await fetch(printTextUrl, {
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
            signal: AbortSignal.timeout(30000),
          });
          if (printResp.ok) {
            const printHtml = await printResp.text();
            const text = htmlToText(printHtml);
            if (text.length > 3000) {
              console.log(`✅ ${Math.round(text.length / 1024)} KB text`);
              return { html: printHtml, url: printTextUrl };
            }
          }
          console.log(`⚠️ малий`);
        } catch (e) {
          console.log(`❌`);
        }
      }
    } catch (err) {
      console.log(`   ❌ Додаток: ${err.message.substring(0, 60)}`);
    }
  }

  return null;
}

// ═══════════════════════════════════════
//  PROCESS ONE ITEM
// ═══════════════════════════════════════

async function downloadItem(item) {
  const nreg = extractNreg(item.sourceUrl);
  if (!nreg) {
    console.error(`   ❌ Не можу визначити nreg з URL: ${item.sourceUrl}`);
    return { success: false, error: 'bad URL' };
  }

  const result = await tryDownload(nreg, item);
  
  if (!result) {
    console.error(`   ❌ Жодна стратегія не спрацювала для ${item.code}`);
    return { success: false, error: 'all strategies failed' };
  }

  const { html, url } = result;
  
  // Convert to clean text
  const text = htmlToText(html);
  console.log(`   📄 ${Math.round(text.length / 1024)} KB clean text`);

  // Count structural elements
  const elements = countElements(text);
  console.log(`   📊 ~${elements.count} ${elements.label}`);

  // Save raw HTML for analysis if content seems thin
  if (elements.count < 3 && text.length < 10000) {
    console.warn(`   ⚠️ Мало змісту! Зберігаю raw HTML для аналізу`);
    const htmlPath = path.join(RAW_DIR, item.filename.replace('.txt', '.raw.html'));
    fs.writeFileSync(htmlPath, html, 'utf-8');
  }

  // Save clean text
  const outputPath = path.join(RAW_DIR, item.filename);
  fs.writeFileSync(outputPath, text, 'utf-8');

  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`   ✅ -> ${item.filename} (${sizeMB} MB, ~${elements.count} ${elements.label}, via ${new URL(url).pathname})`);

  return { success: true, elements: elements.count, elemLabel: elements.label, sizeKB: Math.round(text.length / 1024), url };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════
//  --stats: DATABASE STATISTICS
// ═══════════════════════════════════════

function showStats() {
  console.log('\n📊 AGENTIS Law Database Statistics\n');
  
  const laws = LAWS_REGISTRY.filter(l => l.enabled);
  const sublaws = getEnabledSublaws();
  
  console.log(`  📚 Закони / Кодекси:     ${laws.length}`);
  console.log(`  📋 Підзаконні НПА:       ${sublaws.length}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  📦 Всього в реєстрі:     ${laws.length + sublaws.length}`);
  
  // Count downloaded
  let downloadedLaws = 0, downloadedSublaws = 0;
  let totalSizeKB = 0;
  
  for (const item of [...laws, ...sublaws]) {
    const fp = path.join(RAW_DIR, item.filename);
    if (fs.existsSync(fp)) {
      const size = fs.statSync(fp).size;
      totalSizeKB += Math.round(size / 1024);
      if (item.type) downloadedSublaws++; else downloadedLaws++;
    }
  }
  
  console.log();
  console.log(`  ✅ Завантажено законів:   ${downloadedLaws}/${laws.length}`);
  console.log(`  ✅ Завантажено НПА:       ${downloadedSublaws}/${sublaws.length}`);
  console.log(`  💾 Загальний розмір:      ${(totalSizeKB / 1024).toFixed(1)} MB`);
  
  // By importance
  console.log();
  console.log('  За важливістю:');
  const byImp = {};
  [...laws, ...sublaws].forEach(l => { byImp[l.importance] = (byImp[l.importance] || 0) + 1; });
  console.log(`    🔴 Critical: ${byImp.critical || 0}`);
  console.log(`    🟡 High:     ${byImp.high || 0}`);
  console.log(`    ⚪ Normal:   ${byImp.normal || 0}`);
  
  // Sublaw types
  if (sublaws.length > 0) {
    console.log();
    console.log('  Підзаконні НПА за типом:');
    const byType = {};
    sublaws.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
    const typeLabels = { order: 'Накази', resolution: 'Постанови КМУ', standard: 'Стандарти', law: 'Закони (воєнні)' };
    Object.entries(byType).forEach(([k, v]) => {
      console.log(`    ${(typeLabels[k] || k).padEnd(20)} ${v}`);
    });
  }
  
  console.log();
}

// ═══════════════════════════════════════
//  --list: STATUS CHECK
// ═══════════════════════════════════════

function showList(items, title) {
  console.log(`\n${title}\n`);
  console.log('Status  Code        Size      File');
  console.log('─'.repeat(75));
  
  let okCount = 0;
  
  for (const item of items) {
    if (!item.enabled) continue;
    const filePath = path.join(RAW_DIR, item.filename);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
      const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
      const content = fs.readFileSync(filePath, 'utf-8');
      const elements = countElements(content);
      const good = elements.count > 3 || content.length > 10000;
      const icon = good ? '✅' : '⚠️';
      if (good) okCount++;
      console.log(`${icon} OK   ${item.code.padEnd(10)} ${sizeMB.padStart(6)} MB  ${item.filename} (~${elements.count} ${elements.label})`);
    } else {
      console.log(`❌ MIS  ${item.code.padEnd(10)}          ${item.filename}`);
    }
  }
  
  const total = items.filter(l => l.enabled).length;
  console.log(`\n✅ ${okCount}/${total} з текстом`);
  return { ok: okCount, total };
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const forceOverwrite = args.includes('--force');
  const lawsOnly = args.includes('--laws-only');
  const sublawsOnly = args.includes('--sublaws-only');

  // --stats: Database statistics
  if (args.includes('--stats')) {
    showStats();
    return;
  }

  // --list: Status check
  if (args.includes('--list')) {
    if (!sublawsOnly) {
      showList(LAWS_REGISTRY, '📚 ЗАКОНИ / КОДЕКСИ');
    }
    if (!lawsOnly) {
      showList(SUBLAWS_REGISTRY, '📋 ПІДЗАКОННІ НПА (порядки, типові договори, ліцензії)');
    }
    if (!lawsOnly && !sublawsOnly) {
      console.log(`\n📁 ${RAW_DIR}\n`);
    }
    return;
  }

  console.log('═'.repeat(65));
  console.log('  AGENTIS v3 — Завантаження законів та підзаконних НПА');
  console.log('═'.repeat(65));
  console.log(`\n  Джерела:`);
  console.log(`    📚 laws-registry.js    — ${LAWS_REGISTRY.filter(l => l.enabled).length} законів`);
  console.log(`    📋 sublaws-registry.js — ${getEnabledSublaws().length} підзаконних НПА`);
  console.log(`  Стратегії (по порядку):`);
  console.log(`    1. zakon.rada.gov.ua/laws/file/{nreg}            — прямий HTM`);
  console.log(`    2. zakon.rada.gov.ua/laws/show/{nreg}/conv/print — консолідований текст`);
  console.log(`    3. zakon.rada.gov.ua/laws/show/{nreg}/print      — для друку`);
  console.log(`    4. zakon.rada.gov.ua/laws/show/{nreg}            — сторінка`);
  console.log(`  Пауза між запитами: ${DELAY_MS}ms`);
  if (forceOverwrite) console.log(`  ⚠️ --force: перезаписуємо існуючі файли`);
  if (lawsOnly) console.log(`  🔹 --laws-only: тільки закони`);
  if (sublawsOnly) console.log(`  🔹 --sublaws-only: тільки підзаконні НПА`);
  console.log();

  // Determine which items to download
  let itemsToDownload;
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length > 0) {
    // Specific file requested
    const filename = nonFlagArgs[0];
    const item = findByFilename(filename);
    if (!item) {
      console.error(`❌ "${filename}" не знайдено в жодному реєстрі`);
      console.error(`   Шукали в laws-registry.js та sublaws-registry.js`);
      process.exit(1);
    }
    itemsToDownload = [item];
  } else if (lawsOnly) {
    itemsToDownload = getEnabledLaws();
  } else if (sublawsOnly) {
    itemsToDownload = getEnabledSublaws();
  } else {
    itemsToDownload = getAllEnabled();
  }

  // Filter already downloaded (unless --force)
  if (!forceOverwrite) {
    const before = itemsToDownload.length;
    itemsToDownload = itemsToDownload.filter(item => {
      const filePath = path.join(RAW_DIR, item.filename);
      if (!fs.existsSync(filePath)) return true;
      
      // Re-download if file has insufficient content
      const content = fs.readFileSync(filePath, 'utf-8');
      const elements = countElements(content);
      const isSublaw = !!item.type;
      
      // Laws need articles, sublaws can have пункти or just be large
      const hasGoodContent = isSublaw 
        ? (elements.count > 3 || content.length > 10000)
        : (elements.count > 3);
      
      if (!hasGoodContent) {
        console.log(`🔄 ${item.code} — існуючий файл без змісту, перезавантажую`);
        return true;
      }
      
      console.log(`⏭️  ${item.code} — вже є (~${elements.count} ${elements.label})`);
      return false;
    });
    if (itemsToDownload.length < before) console.log();
  }

  if (itemsToDownload.length === 0) {
    console.log('✅ Все вже завантажено!\n');
    return;
  }

  // Group by type for display
  const lawCount = itemsToDownload.filter(i => !i.type).length;
  const sublawCount = itemsToDownload.filter(i => !!i.type).length;
  console.log(`📥 Завантажую: ${lawCount} законів + ${sublawCount} підзаконних НПА = ${itemsToDownload.length} всього\n`);

  const results = [];

  for (let i = 0; i < itemsToDownload.length; i++) {
    const item = itemsToDownload[i];
    const src = getSourceLabel(item);
    console.log(`\n[${i + 1}/${itemsToDownload.length}] [${src}] ${item.code} — ${item.fullName}`);

    const result = await downloadItem(item);
    results.push({ code: item.code, filename: item.filename, source: src, ...result });

    if (i < itemsToDownload.length - 1) {
      process.stdout.write(`   ⏳ Пауза ${DELAY_MS}ms...`);
      await sleep(DELAY_MS);
      process.stdout.write(' OK\n');
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(65));
  console.log('  РЕЗУЛЬТАТ ЗАВАНТАЖЕННЯ');
  console.log('═'.repeat(65));

  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const info = r.success 
      ? `~${r.elements} ${r.elemLabel}, ${r.sizeKB} KB` 
      : r.error;
    console.log(`  ${icon} [${r.source.padEnd(10)}] ${r.code.padEnd(10)} ${info}`);
  }

  console.log(`\n  Успішно: ${success.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`  Помилки: ${failed.length} (${failed.map(f => f.code).join(', ')})`);
  }

  // Totals
  const totalLaws = LAWS_REGISTRY.filter(l => l.enabled).length;
  const totalSublaws = getEnabledSublaws().length;
  let dlLaws = 0, dlSublaws = 0;
  for (const item of getAllEnabled()) {
    const fp = path.join(RAW_DIR, item.filename);
    if (fs.existsSync(fp)) {
      if (item.type) dlSublaws++; else dlLaws++;
    }
  }
  
  console.log(`\n  📚 Закони:      ${dlLaws}/${totalLaws} завантажено`);
  console.log(`  📋 Підзаконні:  ${dlSublaws}/${totalSublaws} завантажено`);
  console.log(`  📦 Разом:       ${dlLaws + dlSublaws}/${totalLaws + totalSublaws}`);

  console.log(`\n  Наступний крок:`);
  console.log(`    node scripts/parse-universal.js`);
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
