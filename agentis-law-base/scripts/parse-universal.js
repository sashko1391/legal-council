#!/usr/bin/env node
/**
 * AGENTIS Law Database — Універсальний парсер v2
 * 
 * Парсить ЗАКОНИ (Стаття-based) та ПІДЗАКОННІ НПА (пункт-based)
 * із текстів скачаних з zakon.rada.gov.ua.
 * 
 * Джерела:
 *   laws-registry.js    — 200 законів / кодексів
 *   sublaws-registry.js — 35 підзаконних НПА
 * 
 * Запуск:
 *   node scripts/parse-universal.js                     — всі enabled
 *   node scripts/parse-universal.js --laws-only         — тільки закони
 *   node scripts/parse-universal.js --sublaws-only      — тільки підзаконні
 *   node scripts/parse-universal.js cku.txt             — один файл
 *   node scripts/parse-universal.js --list              — показати реєстр
 *   node scripts/parse-universal.js --stats             — статистика парсингу
 * 
 * Вхід:  data/raw/<filename>.txt (plain text з zakon.rada.gov.ua)
 * Вихід: data/parsed/<code>-parsed.json
 */

const fs = require('fs');
const path = require('path');
const { getEnabledLaws, getLawByFilename, LAWS_REGISTRY } = require('./laws-registry');
const { getEnabledSublaws, getSublawByFilename, SUBLAWS_REGISTRY } = require('./sublaws-registry');

// ═══════════════════════════════════════
//  PATHS
// ═══════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PARSED_DIR = path.join(DATA_DIR, 'parsed');

if (!fs.existsSync(PARSED_DIR)) {
  fs.mkdirSync(PARSED_DIR, { recursive: true });
}

// ═══════════════════════════════════════
//  COMBINED REGISTRY
// ═══════════════════════════════════════

function findByFilename(filename) {
  return getLawByFilename(filename) || getSublawByFilename(filename) || null;
}

function getAllEnabled(filter) {
  if (filter === 'laws') return getEnabledLaws();
  if (filter === 'sublaws') return getEnabledSublaws();
  return [...getEnabledLaws(), ...getEnabledSublaws()];
}

function isSublaw(item) {
  return !!item.type; // sublaws have 'type' field (order, resolution, standard, law)
}

// ═══════════════════════════════════════
//  STRUCTURAL PATTERNS — LAWS (Стаття-based)
// ═══════════════════════════════════════

// "Стаття 626. Поняття та види договору"
// "Стаття 48-1. Правові наслідки..."
const ARTICLE_RE = /^Стаття\s+(\d+(?:-\d+)?)\.\s*(.+)$/;

// "КНИГА ПЕРША", "КНИГА ДРУГА"
const BOOK_RE = /^КНИГА\s/;

// "Розділ I ", "Розділ IV", "РОЗДІЛ 1"
const SECTION_RE = /^Розділ\s+([IVXLC]+|\d+)\s*/i;

// "Глава 1 ", "ГЛАВА 52"
const CHAPTER_RE = /^Глава\s+(\d+)/i;

// "§ 2. Роздрібна купівля-продаж"
const PARAGRAPH_RE = /^§\s*\d+/;

// ALL CAPS title
const ALLCAPS_TITLE_RE = /^[А-ЯІЇЄҐ\s''.()\-:,]+$/;

// ═══════════════════════════════════════
//  STRUCTURAL PATTERNS — SUBLAWS (пункт-based)
// ═══════════════════════════════════════

// "1. Цей Порядок визначає..."
// "23. Замовник зобов'язаний..."
// But NOT "1.1." (that's a sub-item, handled differently)
const PUNKT_RE = /^(\d+)\.\s+(.+)/;

// "1.1. Підпункт" — sub-items (will be part of parent punkt text)
const SUBPUNKT_RE = /^(\d+)\.(\d+)\.\s+/;

// "ЗАТВЕРДЖЕНО", "ПОРЯДОК", "ТИПОВИЙ ДОГОВІР"
const HEADER_RE = /^(ЗАТВЕРДЖЕНО|ПОРЯДОК|ТИПОВ|ЛІЦЕНЗІЙНІ|ІНСТРУКЦІЯ|ПРАВИЛА|ПЕРЕЛІК|ВИМОГИ)/;

// ═══════════════════════════════════════
//  PARSER — LAWS (Стаття-based)
// ═══════════════════════════════════════

function parseLawFile(filePath, config) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  let currentBook = '';
  let currentSection = '';
  let currentChapter = '';
  let currentParagraph = '';

  const articles = [];
  let currentArticle = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentArticle) currentArticle.text += '\n';
      continue;
    }

    // --- КНИГА ---
    if (BOOK_RE.test(trimmed)) {
      const nextLine = peekTitleLine(lines, i + 1);
      currentBook = nextLine ? trimmed + ' ' + nextLine : trimmed;
      currentSection = '';
      currentChapter = '';
      currentParagraph = '';
      continue;
    }

    // --- РОЗДІЛ ---
    if (SECTION_RE.test(trimmed)) {
      const nextLine = peekTitleLine(lines, i + 1);
      currentSection = nextLine ? trimmed + ' ' + nextLine : trimmed;
      currentChapter = '';
      currentParagraph = '';
      continue;
    }

    // --- ГЛАВА ---
    if (CHAPTER_RE.test(trimmed)) {
      const nextLine = peekTitleLine(lines, i + 1);
      currentChapter = nextLine ? trimmed + ' ' + nextLine : trimmed;
      currentParagraph = '';
      continue;
    }

    // --- ПАРАГРАФ ---
    if (PARAGRAPH_RE.test(trimmed)) {
      currentParagraph = trimmed;
      continue;
    }

    // --- СТАТТЯ ---
    const articleMatch = trimmed.match(ARTICLE_RE);
    if (articleMatch) {
      if (currentArticle) {
        currentArticle.text = cleanText(currentArticle.text);
        articles.push(currentArticle);
      }

      currentArticle = {
        id: `${config.code}-${articleMatch[1]}`,
        code: config.code,
        article_number: articleMatch[1],
        title: articleMatch[2].trim(),
        text: '',
        unit_type: 'стаття',
        book: currentBook || undefined,
        section: currentSection || undefined,
        chapter: currentChapter || undefined,
        paragraph: currentParagraph || undefined,
        source_url: config.sourceUrl + '#Text',
        last_verified: new Date().toISOString().split('T')[0],
      };
      continue;
    }

    // --- TEXT ---
    if (currentArticle) {
      currentArticle.text += line + '\n';
    }
  }

  if (currentArticle) {
    currentArticle.text = cleanText(currentArticle.text);
    articles.push(currentArticle);
  }

  return buildResult(config, articles);
}

// ═══════════════════════════════════════
//  PARSER — SUBLAWS (пункт-based)
// ═══════════════════════════════════════

/**
 * Parse a sublaw that uses "1. Text", "2. Text" structure
 * instead of "Стаття N. Title".
 * 
 * Strategy:
 *   - Top-level пункти (N.) become separate items
 *   - Sub-items (N.M.) are part of parent пункт text
 *   - If file also has Стаття pattern → fall back to law parser
 *   - Sections/Chapters still tracked for context
 */
function parseSublawFile(filePath, config) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  
  // Quick check: if file has many "Стаття N" → use law parser instead
  const articleCount = (raw.match(/^Стаття\s+\d+\./gm) || []).length;
  const punktCount = (raw.match(/^\d+\.\s+/gm) || []).length;
  
  if (articleCount > 5 && articleCount > punktCount * 0.5) {
    // This sublaw actually has Стаття structure (some laws in sublaws registry do)
    return parseLawFile(filePath, config);
  }

  const lines = raw.split('\n');
  
  let currentSection = '';
  let currentChapter = '';
  let headerText = ''; // ЗАТВЕРДЖЕНО / title block
  
  const items = [];
  let currentItem = null;
  let headerDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentItem) currentItem.text += '\n';
      continue;
    }

    // --- Capture header block (before first punkt) ---
    if (!headerDone && HEADER_RE.test(trimmed)) {
      headerText += trimmed + '\n';
      continue;
    }

    // --- СТАТТЯ (some sublaws mix both) ---
    const articleMatch = trimmed.match(ARTICLE_RE);
    if (articleMatch) {
      headerDone = true;
      if (currentItem) {
        currentItem.text = cleanText(currentItem.text);
        items.push(currentItem);
      }
      currentItem = {
        id: `${config.code}-ст${articleMatch[1]}`,
        code: config.code,
        article_number: `ст.${articleMatch[1]}`,
        title: articleMatch[2].trim(),
        text: '',
        unit_type: 'стаття',
        section: currentSection || undefined,
        chapter: currentChapter || undefined,
        source_url: config.sourceUrl + '#Text',
        last_verified: new Date().toISOString().split('T')[0],
      };
      continue;
    }

    // --- РОЗДІЛ ---
    if (SECTION_RE.test(trimmed)) {
      headerDone = true;
      const nextLine = peekTitleLine(lines, i + 1);
      currentSection = nextLine ? trimmed + ' ' + nextLine : trimmed;
      currentChapter = '';
      continue;
    }

    // --- ГЛАВА ---
    if (CHAPTER_RE.test(trimmed)) {
      headerDone = true;
      const nextLine = peekTitleLine(lines, i + 1);
      currentChapter = nextLine ? trimmed + ' ' + nextLine : trimmed;
      continue;
    }

    // --- TOP-LEVEL ПУНКТ (N. text) ---
    // Must NOT be a sub-item (N.M.)
    const punktMatch = trimmed.match(PUNKT_RE);
    if (punktMatch && !SUBPUNKT_RE.test(trimmed)) {
      headerDone = true;
      
      if (currentItem) {
        currentItem.text = cleanText(currentItem.text);
        items.push(currentItem);
      }

      const punktNum = punktMatch[1];
      // Title = first ~80 chars of the punkt text
      const punktText = punktMatch[2].trim();
      const title = punktText.length > 80 
        ? punktText.substring(0, 77) + '...' 
        : punktText;

      currentItem = {
        id: `${config.code}-п${punktNum}`,
        code: config.code,
        article_number: `п.${punktNum}`,
        title: title,
        text: punktText + '\n',
        unit_type: 'пункт',
        section: currentSection || undefined,
        chapter: currentChapter || undefined,
        source_url: config.sourceUrl + '#Text',
        last_verified: new Date().toISOString().split('T')[0],
      };
      continue;
    }

    // --- TEXT (belongs to current item) ---
    if (currentItem) {
      currentItem.text += line + '\n';
    } else if (!headerDone) {
      headerText += trimmed + '\n';
    }
  }

  if (currentItem) {
    currentItem.text = cleanText(currentItem.text);
    items.push(currentItem);
  }

  return buildResult(config, items);
}

// ═══════════════════════════════════════
//  BUILD RESULT
// ═══════════════════════════════════════

function buildResult(config, articles) {
  return {
    code: config.code,
    full_name: config.fullName,
    document_id: config.documentId,
    source_url: config.sourceUrl,
    type: config.type || 'law',
    issuer: config.issuer || 'ВРУ',
    parsed_date: new Date().toISOString().split('T')[0],
    total_articles: articles.length,
    articles,
  };
}

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════

function peekTitleLine(lines, index) {
  if (index >= lines.length) return null;
  const nextLine = lines[index].trim();
  if (nextLine && ALLCAPS_TITLE_RE.test(nextLine)) {
    return nextLine;
  }
  return null;
}

function cleanText(text) {
  return text
    .trim()
    .replace(/\n(КНИГА\s.+)/g, '')
    .replace(/\n(Розділ\s+[IVXLC]+\s*)/gi, '')
    .replace(/\n(Глава\s+\d+\s*)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getOutputFilename(config) {
  return `${config.code.toLowerCase()}-parsed.json`;
}

// ═══════════════════════════════════════
//  PROCESS ONE ITEM
// ═══════════════════════════════════════

function parseItem(config) {
  const rawPath = path.join(RAW_DIR, config.filename);
  
  if (!fs.existsSync(rawPath)) {
    return { status: 'missing', code: config.code, count: 0 };
  }

  // Choose parser based on registry source
  const result = isSublaw(config)
    ? parseSublawFile(rawPath, config)
    : parseLawFile(rawPath, config);

  if (result.articles.length === 0) {
    return { status: 'empty', code: config.code, count: 0 };
  }

  // Save
  const outputFile = path.join(PARSED_DIR, getOutputFilename(config));
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');

  return {
    status: 'ok',
    code: config.code,
    count: result.articles.length,
    outputFile,
    sizeKB: Math.round(fs.statSync(outputFile).size / 1024),
    unitType: result.articles[0]?.unit_type || 'стаття',
    first: result.articles[0],
    last: result.articles[result.articles.length - 1],
    books: new Set(result.articles.map(a => a.book).filter(Boolean)).size,
    sections: new Set(result.articles.map(a => a.section).filter(Boolean)).size,
    chapters: new Set(result.articles.map(a => a.chapter).filter(Boolean)).size,
  };
}

// ═══════════════════════════════════════
//  --stats: PARSING STATISTICS
// ═══════════════════════════════════════

function showStats() {
  console.log('\n📊 AGENTIS Parsed Database Statistics\n');
  
  let totalLawArticles = 0, totalSublawItems = 0;
  let parsedLaws = 0, parsedSublaws = 0;
  let totalSizeKB = 0;
  
  for (const item of [...getEnabledLaws(), ...getEnabledSublaws()]) {
    const outputFile = path.join(PARSED_DIR, getOutputFilename(item));
    if (!fs.existsSync(outputFile)) continue;
    
    try {
      const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      totalSizeKB += Math.round(fs.statSync(outputFile).size / 1024);
      if (isSublaw(item)) {
        parsedSublaws++;
        totalSublawItems += data.total_articles;
      } else {
        parsedLaws++;
        totalLawArticles += data.total_articles;
      }
    } catch {}
  }
  
  const totalEnabledLaws = getEnabledLaws().length;
  const totalEnabledSublaws = getEnabledSublaws().length;
  
  console.log(`  📚 Закони:       ${parsedLaws}/${totalEnabledLaws} парсено, ${totalLawArticles} статей`);
  console.log(`  📋 Підзаконні:   ${parsedSublaws}/${totalEnabledSublaws} парсено, ${totalSublawItems} пунктів`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  📦 Разом:        ${parsedLaws + parsedSublaws}/${totalEnabledLaws + totalEnabledSublaws} парсено`);
  console.log(`  📊 Структурних одиниць: ${totalLawArticles + totalSublawItems}`);
  console.log(`  💾 Розмір JSON:  ${(totalSizeKB / 1024).toFixed(1)} MB`);
  console.log();
}

// ═══════════════════════════════════════
//  --list: SHOW REGISTRY
// ═══════════════════════════════════════

function showList(items, title) {
  console.log(`\n${title}\n`);
  console.log('Status  Code        Count  Unit    File');
  console.log('─'.repeat(75));
  
  for (const item of items) {
    if (!item.enabled) continue;
    const rawExists = fs.existsSync(path.join(RAW_DIR, item.filename));
    const parsedFile = path.join(PARSED_DIR, getOutputFilename(item));
    const parsedExists = fs.existsSync(parsedFile);
    
    let status, count = '-', unit = '';
    if (!rawExists) {
      status = '❌ MIS';
    } else if (!parsedExists) {
      status = '🔸 RAW';
    } else {
      try {
        const data = JSON.parse(fs.readFileSync(parsedFile, 'utf-8'));
        count = String(data.total_articles);
        unit = data.articles[0]?.unit_type || '';
        status = data.total_articles > 0 ? '✅ OK ' : '⚠️ EMP';
      } catch {
        status = '⚠️ ERR';
      }
    }
    
    console.log(`${status}   ${item.code.padEnd(10)} ${count.padStart(5)}  ${unit.padEnd(7)} ${item.filename}`);
  }
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const lawsOnly = args.includes('--laws-only');
  const sublawsOnly = args.includes('--sublaws-only');

  // --stats
  if (args.includes('--stats')) {
    showStats();
    return;
  }

  // --list
  if (args.includes('--list')) {
    if (!sublawsOnly) showList(LAWS_REGISTRY, '📚 ЗАКОНИ / КОДЕКСИ');
    if (!lawsOnly) showList(SUBLAWS_REGISTRY, '📋 ПІДЗАКОННІ НПА');
    
    const totalLaws = LAWS_REGISTRY.filter(l => l.enabled).length;
    const totalSublaws = getEnabledSublaws().length;
    console.log('\n' + '─'.repeat(75));
    console.log(`Разом у реєстрі: ${totalLaws + totalSublaws} (${totalLaws} законів + ${totalSublaws} НПА)`);
    console.log(`Raw dir:    ${RAW_DIR}`);
    console.log(`Parsed dir: ${PARSED_DIR}\n`);
    return;
  }

  console.log('═'.repeat(60));
  console.log('  AGENTIS v2 — Універсальний парсер законодавства');
  console.log('═'.repeat(60));
  console.log();

  // Determine what to parse
  let itemsToParse;
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length > 0) {
    const filename = nonFlagArgs[0];
    const config = findByFilename(filename);
    if (!config) {
      console.error(`❌ "${filename}" не знайдено в жодному реєстрі`);
      console.error('   Запустіть з --list щоб побачити всі зареєстровані НПА');
      process.exit(1);
    }
    itemsToParse = [config];
  } else {
    const filter = lawsOnly ? 'laws' : sublawsOnly ? 'sublaws' : 'all';
    itemsToParse = getAllEnabled(filter);
  }

  console.log(`📥 Парсю ${itemsToParse.length} нормативних актів...\n`);

  let totalArticles = 0;
  let parsedCount = 0;
  let skippedCount = 0;
  const results = [];

  for (const config of itemsToParse) {
    const src = isSublaw(config) ? '[НПА]' : '[Закон]';
    process.stdout.write(`${src} ${config.code.padEnd(10)} — `);

    const result = parseItem(config);

    if (result.status === 'missing') {
      console.log(`⏭️  файл не знайдено`);
      skippedCount++;
      continue;
    }

    if (result.status === 'empty') {
      console.log(`⚠️  0 елементів знайдено`);
      skippedCount++;
      continue;
    }

    // Success
    const unitLabel = result.unitType === 'пункт' ? 'п.' : 'ст.';
    console.log(`✅ ${result.count} ${unitLabel} (${result.sizeKB} KB)`);

    // Structure info for verbose
    const parts = [];
    if (result.books > 0) parts.push(`${result.books} книг`);
    if (result.sections > 0) parts.push(`${result.sections} розд.`);
    if (result.chapters > 0) parts.push(`${result.chapters} глав`);
    if (parts.length > 0) {
      console.log(`           ↳ ${parts.join(', ')}`);
    }

    totalArticles += result.count;
    parsedCount++;
    results.push({ code: config.code, count: result.count, unitType: result.unitType });
  }

  // ═══════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════

  console.log('\n' + '═'.repeat(60));
  console.log('  РЕЗУЛЬТАТ ПАРСИНГУ');
  console.log('═'.repeat(60));
  console.log();

  const lawResults = results.filter(r => r.unitType === 'стаття');
  const sublawResults = results.filter(r => r.unitType === 'пункт');
  const totalLawArticles = lawResults.reduce((s, r) => s + r.count, 0);
  const totalSublawItems = sublawResults.reduce((s, r) => s + r.count, 0);

  if (lawResults.length > 0) {
    console.log(`  📚 Закони: ${lawResults.length} парсено, ${totalLawArticles} статей`);
  }
  if (sublawResults.length > 0) {
    console.log(`  📋 НПА:    ${sublawResults.length} парсено, ${totalSublawItems} пунктів`);
  }
  console.log(`  📦 Разом:  ${totalArticles} структурних одиниць з ${parsedCount} актів`);
  
  if (skippedCount > 0) {
    console.log(`  ⏭️  Пропущено: ${skippedCount} (файл не знайдено або 0 елементів)`);
  }

  console.log(`\n  Наступний крок:`);
  console.log(`    node scripts/03-categorize.js     — категоризація за типами договорів`);
  console.log(`    node scripts/04-embed.js           — створення embeddings для Pinecone`);
  console.log();
}

main();
