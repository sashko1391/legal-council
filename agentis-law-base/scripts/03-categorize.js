#!/usr/bin/env node
/**
 * Station 3: Категоризація статей — v2 (Universal)
 * 
 * Обробляє ВСІ парсені файли з data/parsed/, а не тільки ЦКУ+КЗпП.
 * 
 * Стратегія категоризації:
 *   - ЦКУ: детальний mapping Book+Chapter → categories (як раніше)
 *   - КЗпП: детальний mapping Chapter → categories (як раніше)
 *   - Усі інші: defaultCategories + defaultTags з laws-registry.js / sublaws-registry.js
 *   - Keyword-based tagging: застосовується до ВСІХ статей
 * 
 * Запуск: node scripts/03-categorize.js
 * Вхід:  data/parsed/*-parsed.json (усі файли)
 * Вихід: data/categorized/all-articles-categorized.json
 * 
 * FIX M1 (Feb 14, 2026): Article-number-range fallback for ЦКУ
 */

const fs = require('fs');
const path = require('path');
const { getLawByCode, LAWS_REGISTRY } = require('./laws-registry');

// Try loading sublaws registry (may not exist yet)
let getSublawByCode = () => null;
let SUBLAWS_REGISTRY = [];
try {
  const sub = require('./sublaws-registry');
  getSublawByCode = sub.getSublawByCode;
  SUBLAWS_REGISTRY = sub.SUBLAWS_REGISTRY || [];
} catch (e) {
  console.log('ℹ️  sublaws-registry.js not found, skipping sublaws metadata');
}

// ═══════════════════════════════════════
//  PATHS
// ═══════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'data');
const PARSED_DIR = path.join(DATA_DIR, 'parsed');
const OUTPUT_DIR = path.join(DATA_DIR, 'categorized');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ═══════════════════════════════════════
//  CONTRACT TYPE CATEGORIES
// ═══════════════════════════════════════

const CATEGORIES = {
  general_contract: 'Загальні положення про договори',
  sale: 'Купівля-продаж',
  lease: 'Оренда / Найм',
  service: 'Послуги',
  work: 'Підряд',
  loan: 'Позика / Кредит',
  storage: 'Зберігання',
  transportation: 'Перевезення',
  insurance: 'Страхування',
  agency: 'Доручення / Комісія / Управління',
  partnership: 'Спільна діяльність',
  employment: 'Трудові відносини',
  employment_termination: 'Припинення трудового договору',
  wages: 'Оплата праці',
  working_time: 'Робочий час і відпочинок',
  labor_protection: 'Охорона праці',
  labor_discipline: 'Трудова дисципліна',
  labor_disputes: 'Трудові спори',
  material_liability: 'Матеріальна відповідальність',
  women_youth: 'Праця жінок та молоді',
  obligations_general: "Загальні положення зобов'язань",
  liability: 'Відповідальність за порушення',
  property: 'Право власності',
  persons: 'Фізичні та юридичні особи',
  intellectual_property: 'Інтелектуальна власність',
  inheritance: 'Спадкування',
  personal_rights: 'Особисті немайнові права',
  collective_agreement: 'Колективний договір',
  social_insurance: 'Соціальне страхування',
  education_benefits: 'Пільги (робота + навчання)',
  domestic_workers: 'Праця домашніх працівників',
  simplified_labor: 'Спрощений режим трудових відносин',
  // New categories for expanded law base
  commercial: 'Господарське право',
  tax: 'Податкове право',
  administrative: 'Адміністративне право',
  criminal: 'Кримінальне право',
  procedural: 'Процесуальне право',
  civil_procedure: 'Цивільний процес',
  commercial_procedure: 'Господарський процес',
  criminal_procedure: 'Кримінальний процес',
  administrative_procedure: 'Адміністративний процес',
  family: 'Сімейне право',
  land: 'Земельне право',
  housing: 'Житлове право',
  corporate: 'Корпоративне право',
  banking: 'Банківське право',
  consumer: 'Захист споживачів',
  competition: 'Конкуренція',
  energy: 'Енергетика',
  construction: 'Будівництво',
  transport: 'Транспорт',
  it_telecom: 'ІТ та телекомунікації',
  data_protection: 'Захист персональних даних',
  enforcement: 'Виконавче провадження',
  bankruptcy: 'Банкрутство',
  notary: 'Нотаріат',
  registration: 'Державна реєстрація',
  licensing: 'Ліцензування',
  foreign_trade: 'ЗЕД',
  military: 'Військове право',
  education: 'Освіта',
  healthcare: 'Охорона здоровʼя',
  environment: 'Екологія',
  agriculture: 'Сільське господарство',
  media: 'Медіа та інформація',
};

// ═══════════════════════════════════════
//  ЦКУ: DETAILED MAPPINGS (as before)
// ═══════════════════════════════════════

const CKU_BOOK_CATEGORIES = {
  '1': ['persons'], '2': ['personal_rights'], '3': ['property'],
  '4': ['intellectual_property'], '5': ['obligations_general'], '6': ['inheritance'],
};

const CKU_CHAPTER_CATEGORIES = {
  '47': ['obligations_general'], '48': ['obligations_general'],
  '49': ['obligations_general'], '50': ['obligations_general'],
  '51': ['liability'], '52': ['general_contract'], '53': ['general_contract'],
  '54': ['sale'], '55': ['sale'], '56': ['sale'],
  '57': ['lease'], '58': ['lease'],
  '59': ['loan'], '60': ['storage'],
  '61': ['work'], '62': ['work'], '63': ['service'],
  '64': ['transportation'], '65': ['storage'], '66': ['insurance'],
  '67': ['agency'], '68': ['agency'], '69': ['agency'],
  '70': ['loan'], '71': ['loan'], '72': ['loan'], '73': ['loan'],
  '74': ['partnership'], '75': ['general_contract'],
  '76': ['liability'], '77': ['liability'],
  '3': ['persons'], '4': ['persons'], '5': ['persons'],
  '7': ['persons'], '8': ['persons'], '18': ['persons'], '19': ['persons'],
};

const CKU_ARTICLE_RANGE_CATEGORIES = [
  { from: 626, to: 654, categories: ['general_contract'] },
  { from: 655, to: 711, categories: ['sale'] },
  { from: 717, to: 730, categories: ['sale'] },
  { from: 731, to: 743, categories: ['sale'] },
  { from: 759, to: 809, categories: ['lease'] },
  { from: 810, to: 826, categories: ['lease'] },  // FIX M1
  { from: 827, to: 836, categories: ['loan'] },
  { from: 837, to: 891, categories: ['work'] },
  { from: 901, to: 907, categories: ['service'] },
  { from: 908, to: 935, categories: ['transportation'] },
  { from: 936, to: 978, categories: ['storage'] },
  { from: 979, to: 999, categories: ['insurance'] },
  { from: 1000, to: 1045, categories: ['agency'] },
  { from: 1046, to: 1097, categories: ['loan'] },
  { from: 1166, to: 1215, categories: ['liability'] },
];

const CRITICAL_CKU_ARTICLES = new Set([
  '203', '215', '216', '217', '218', '229', '230', '231', '232', '233', '234',
  '509', '525', '526', '527', '530', '533', '546', '549', '550', '551',
  '610', '611', '612', '613', '614', '615', '616', '617', '623', '624',
  '626', '627', '628', '629', '631', '632', '638', '639', '640', '641',
  '642', '643', '651', '652', '653', '654',
  '655', '656', '662', '665', '668', '669', '670', '671', '672',
  '759', '760', '762', '763', '773', '774',
  '810', '813', '815', '825',
  '837', '839', '843', '846', '849',
  '901', '902', '903', '905',
  '1046', '1054', '1057',
]);

// ═══════════════════════════════════════
//  КЗпП: DETAILED MAPPINGS (as before)
// ═══════════════════════════════════════

const KZPP_CHAPTER_CATEGORIES = {
  'I': ['employment'], 'II': ['collective_agreement'],
  'III': ['employment', 'employment_termination'], 'III-А': ['employment_termination'],
  'III-Б': ['simplified_labor'],
  'IV': ['working_time'], 'V': ['working_time'],
  'VI': ['wages'], 'VII': ['wages'], 'VIII': ['employment'],
  'IX': ['material_liability'], 'X': ['labor_discipline'],
  'XI': ['labor_protection'], 'XI-А': ['domestic_workers'],
  'XII': ['women_youth'], 'XIII': ['women_youth'],
  'XIV': ['education_benefits'], 'XV': ['labor_disputes'],
  'XVI': ['employment'], 'XVI-А': ['employment'],
  'XVII': ['social_insurance'], 'XVIII': ['labor_protection'],
  'XIX': ['employment'],
};

const CRITICAL_KZPP_ARTICLES = new Set([
  '21', '22', '23', '24', '26', '28', '29', '30', '31', '32', '33',
  '36', '38', '39', '40', '41', '42', '43', '44', '46', '47', '48',
  '49-5', '49-6', '49-8',
  '50', '51', '56',
  '94', '95', '96', '97', '103', '105', '106', '107',
  '115', '116', '117',
  '130', '132', '133', '134', '135', '136',
  '139', '140', '141', '142', '147', '148',
  '153', '155', '157', '158', '159',
  '175', '176', '177', '178', '179', '180', '181', '182', '184',
  '221', '222', '223', '225', '228', '229', '232', '233', '234', '235',
  '265',
]);

// ═══════════════════════════════════════
//  KEYWORD-BASED TAGGING (all laws)
// ═══════════════════════════════════════

const KEYWORD_TAGS = [
  { keywords: ['істотні умови', 'істотних умов', 'предмет договору'], tag: 'essential_terms' },
  { keywords: ['недійсн', 'нікчемн', 'оспорюван'], tag: 'invalidity' },
  { keywords: ['відповідальність', 'штраф', 'пеня', 'неустойк', 'збитк'], tag: 'liability' },
  { keywords: ['строк', 'термін', 'давність'], tag: 'deadlines' },
  { keywords: ['розірван', 'припинен', 'скасуван'], tag: 'termination' },
  { keywords: ['форма договору', 'письмова форма', 'нотаріальн'], tag: 'form_requirements' },
  { keywords: ['гарантій', 'забезпечен', 'заставу', 'порук', 'завдат'], tag: 'guarantees' },
  { keywords: ['ціна', 'оплат', 'розрахунк', 'плат'], tag: 'payment' },
  { keywords: ['передач', 'приймання', 'акт'], tag: 'delivery' },
  { keywords: ['якість', 'недолік', 'дефект', 'гарантійн'], tag: 'quality' },
  { keywords: ['звільнен', 'вивільнен', 'скорочен'], tag: 'dismissal' },
  { keywords: ['відпустк'], tag: 'vacation' },
  { keywords: ['випробуван'], tag: 'probation' },
  { keywords: ['дискримінац', 'мобінг', 'цькуван'], tag: 'discrimination' },
  { keywords: ['вагітн', 'жінк', 'материнств'], tag: 'maternity' },
  { keywords: ['неповнолітн', 'молод'], tag: 'youth_labor' },
  { keywords: ['конфіденцій', 'комерційна таємниц'], tag: 'confidentiality' },
  { keywords: ['форс-мажор', 'непереборн', 'непередбачуван'], tag: 'force_majeure' },
  // New tags for expanded base
  { keywords: ['реєстрац', 'державний реєстр'], tag: 'registration' },
  { keywords: ['ліцензі', 'дозвіл', 'ліцензування'], tag: 'licensing' },
  { keywords: ['оренда', 'орендар', 'орендодавець', 'найм'], tag: 'rent' },
  { keywords: ['нерухом', 'будівл', 'приміщен', 'квартир', 'житло'], tag: 'real_estate' },
  { keywords: ['земел', 'ділянк', 'кадастр'], tag: 'land' },
  { keywords: ['податок', 'податків', 'ПДВ', 'єдиний податок'], tag: 'tax' },
  { keywords: ['банкрутств', 'неплатоспроможн', 'санація'], tag: 'bankruptcy' },
  { keywords: ['акціонер', 'статутний капітал', 'засновник', 'учасник товариства'], tag: 'corporate' },
  { keywords: ['тендер', 'закупівл', 'прозорро'], tag: 'procurement' },
  { keywords: ['інтелектуальн', 'авторськ', 'патент', 'торговельна марка'], tag: 'ip' },
  { keywords: ['персональн', 'захист даних', 'приватність'], tag: 'data_protection' },
  { keywords: ['споживач', 'рекламація', 'повернення товару'], tag: 'consumer_rights' },
  { keywords: ['виконавче провадження', 'стягнення', 'виконавець'], tag: 'enforcement' },
];

// ═══════════════════════════════════════
//  CATEGORIZATION FUNCTIONS
// ═══════════════════════════════════════

function getCkuArticleRangeCategories(articleNumber) {
  const num = parseInt(articleNumber, 10);
  if (isNaN(num)) return null;
  for (const range of CKU_ARTICLE_RANGE_CATEGORIES) {
    if (num >= range.from && num <= range.to) return range.categories;
  }
  return null;
}

function extractBookNum(bookStr) {
  if (!bookStr) return null;
  if (bookStr.includes('ПЕРША')) return '1';
  if (bookStr.includes('ДРУГА')) return '2';
  if (bookStr.includes('ТРЕТЯ')) return '3';
  if (bookStr.includes('ЧЕТВЕРТА')) return '4';
  if (bookStr.includes("П'ЯТА")) return '5';
  if (bookStr.includes('ШОСТА')) return '6';
  return null;
}

function extractChapterNum(chapterStr) {
  if (!chapterStr) return null;
  const m = chapterStr.match(/Глава\s+(\d+)/i);
  return m ? m[1] : null;
}

function extractKzppChapter(chapterStr) {
  if (!chapterStr) return null;
  // КЗпП uses Roman numerals: "III", "III-А", "XI-А" etc.
  const m = chapterStr.match(/^([IVXLC]+-?[А-Я]?)/);
  return m ? m[1] : chapterStr;
}

/**
 * Categorize ЦКУ article with detailed book/chapter mapping.
 */
function categorizeCku(article) {
  let categories = [];
  let importance = 'normal';

  // 1. Article range (most reliable) → Chapter → Book
  const rangeCats = getCkuArticleRangeCategories(article.article_number);
  if (rangeCats) {
    categories = [...rangeCats];
  } else {
    const chapterNum = extractChapterNum(article.chapter);
    if (chapterNum && CKU_CHAPTER_CATEGORIES[chapterNum]) {
      categories = [...CKU_CHAPTER_CATEGORIES[chapterNum]];
    } else {
      const bookNum = extractBookNum(article.book);
      if (bookNum && CKU_BOOK_CATEGORIES[bookNum]) {
        categories = [...CKU_BOOK_CATEGORIES[bookNum]];
      }
    }
  }

  // 2. Importance
  if (CRITICAL_CKU_ARTICLES.has(article.article_number)) {
    importance = 'critical';
  } else {
    const bookNum = extractBookNum(article.book);
    if (bookNum === '5') importance = 'high';
  }

  if (categories.length === 0) categories = ['general_contract'];
  return { categories, importance };
}

/**
 * Categorize КЗпП article with detailed chapter mapping.
 */
function categorizeKzpp(article) {
  let categories = [];
  let importance = 'normal';

  const chapter = extractKzppChapter(article.chapter);
  if (chapter && KZPP_CHAPTER_CATEGORIES[chapter]) {
    categories = [...KZPP_CHAPTER_CATEGORIES[chapter]];
  }

  // Special: chapter III art 36-49 = employment_termination
  if (chapter === 'III') {
    const num = parseInt(article.article_number);
    if (num >= 36 && num <= 49) {
      categories = ['employment_termination'];
    }
  }

  if (CRITICAL_KZPP_ARTICLES.has(article.article_number)) {
    importance = 'critical';
  } else {
    importance = 'high';
  }

  if (categories.length === 0) categories = ['employment'];
  return { categories, importance };
}

/**
 * Categorize any other law using registry metadata.
 */
function categorizeFromRegistry(article) {
  const code = article.code;
  const reg = getLawByCode(code) || getSublawByCode(code);
  
  let categories = [];
  let importance = 'normal';
  let registryTags = [];

  if (reg) {
    categories = [...(reg.defaultCategories || [])];
    registryTags = [...(reg.defaultTags || [])];
    importance = reg.importance || 'normal';
  }

  if (categories.length === 0) categories = ['general_contract'];
  return { categories, importance, registryTags };
}

/**
 * Get keyword-based tags from article text.
 */
function getKeywordTags(article) {
  const tags = [];
  const textToSearch = `${article.title || ''} ${article.text || ''}`.toLowerCase();
  for (const { keywords, tag } of KEYWORD_TAGS) {
    if (keywords.some(kw => textToSearch.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }
  return tags;
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

function main() {
  console.log('═'.repeat(55));
  console.log('  AGENTIS v2 — Категоризація статей (Universal)');
  console.log('═'.repeat(55));
  console.log();

  // 1. Discover all parsed files
  if (!fs.existsSync(PARSED_DIR)) {
    console.error(`❌ Parsed dir not found: ${PARSED_DIR}`);
    console.error('   Run first: node scripts/parse-universal.js');
    process.exit(1);
  }

  const parsedFiles = fs.readdirSync(PARSED_DIR)
    .filter(f => f.endsWith('-parsed.json'))
    .sort();

  console.log(`📂 Found ${parsedFiles.length} parsed files in ${PARSED_DIR}\n`);

  if (parsedFiles.length === 0) {
    console.error('❌ No parsed files found. Run: node scripts/parse-universal.js');
    process.exit(1);
  }

  // 2. Process each file
  const allCategorized = [];
  const stats = { byCodes: {}, byImportance: { critical: 0, high: 0, normal: 0 } };

  for (const filename of parsedFiles) {
    const filePath = path.join(PARSED_DIR, filename);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.warn(`⚠️  Failed to read ${filename}: ${err.message}`);
      continue;
    }

    const articles = data.articles || data;
    if (!Array.isArray(articles) || articles.length === 0) {
      console.log(`⏭️  ${filename} — no articles, skipping`);
      continue;
    }

    const code = articles[0]?.code || data.code || filename.replace('-parsed.json', '').toUpperCase();
    process.stdout.write(`  ${code.padEnd(12)} ${String(articles.length).padStart(5)} articles → `);

    let categorizedCount = 0;

    for (const article of articles) {
      // Skip excluded articles
      if (article.is_excluded) continue;

      // Choose categorization strategy
      let categories, importance, registryTags = [];

      if (article.code === 'ЦКУ') {
        ({ categories, importance } = categorizeCku(article));
      } else if (article.code === 'КЗпП') {
        ({ categories, importance } = categorizeKzpp(article));
      } else {
        ({ categories, importance, registryTags } = categorizeFromRegistry(article));
      }

      // Keyword-based tags (all laws)
      const keywordTags = getKeywordTags(article);
      const allTags = [...new Set([...registryTags, ...keywordTags])];

      allCategorized.push({
        id: article.id || `${(article.code || code).toLowerCase()}_${article.article_number.replace(/[-. ]/g, '_')}`,
        code: article.code || code,
        article_number: article.article_number,
        title: article.title || '',
        text: article.text || '',
        unit_type: article.unit_type || 'стаття',
        book: article.book || null,
        section: article.section || null,
        chapter: article.chapter || null,
        paragraph: article.paragraph || null,
        categories: [...new Set(categories)],
        tags: allTags,
        importance,
        metadata: {
          code_full_name: data.full_name || '',
          source: 'zakon.rada.gov.ua',
          source_url: article.source_url || data.source_url || '',
          categorized_at: new Date().toISOString(),
        },
      });

      categorizedCount++;
      stats.byImportance[importance] = (stats.byImportance[importance] || 0) + 1;
    }

    stats.byCodes[code] = categorizedCount;
    console.log(`✅ ${categorizedCount}`);
  }

  // 3. FIX M1 verification: ЦКУ Chapter 58
  const ch58Check = allCategorized.filter(a => {
    const num = parseInt(a.article_number, 10);
    return a.code === 'ЦКУ' && num >= 810 && num <= 826;
  });
  const ch58Wrong = ch58Check.filter(a => !a.categories.includes('lease'));
  if (ch58Wrong.length > 0) {
    console.warn(`\n⚠️  FIX M1: ${ch58Wrong.length} articles in 810-826 NOT categorized as 'lease'`);
  } else if (ch58Check.length > 0) {
    console.log(`\n✅ FIX M1: All ${ch58Check.length} articles in 810-826 correctly = 'lease'`);
  }

  // 4. Statistics
  console.log('\n' + '═'.repeat(55));
  console.log('  РЕЗУЛЬТАТ КАТЕГОРИЗАЦІЇ');
  console.log('═'.repeat(55));
  console.log();
  console.log(`  Total: ${allCategorized.length} articles from ${Object.keys(stats.byCodes).length} laws`);

  console.log(`\n📊 By importance:`);
  console.log(`  🔴 Critical: ${stats.byImportance.critical || 0}`);
  console.log(`  🟡 High:     ${stats.byImportance.high || 0}`);
  console.log(`  ⚪ Normal:   ${stats.byImportance.normal || 0}`);

  // Top categories
  const catCounts = {};
  for (const art of allCategorized) {
    for (const cat of art.categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\n📋 By category (top 20):`);
  for (const [cat, count] of sortedCats.slice(0, 20)) {
    const label = CATEGORIES[cat] || cat;
    console.log(`  ${cat.padEnd(28)} ${String(count).padStart(5)}  (${label})`);
  }

  // Top tags
  const tagCounts = {};
  for (const art of allCategorized) {
    for (const tag of art.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\n🏷️  By tag (top 15):`);
  for (const [tag, count] of sortedTags.slice(0, 15)) {
    console.log(`  ${tag.padEnd(22)} ${String(count).padStart(5)}`);
  }

  // Top codes by article count
  const sortedCodes = Object.entries(stats.byCodes).sort((a, b) => b[1] - a[1]);
  console.log(`\n📚 By law (top 15):`);
  for (const [code, count] of sortedCodes.slice(0, 15)) {
    console.log(`  ${code.padEnd(12)} ${String(count).padStart(5)} articles`);
  }

  // 5. Save output
  const outputFile = path.join(OUTPUT_DIR, 'all-articles-categorized.json');
  fs.writeFileSync(outputFile, JSON.stringify(allCategorized, null, 2), 'utf-8');
  const fileSizeMB = (fs.statSync(outputFile).size / (1024 * 1024)).toFixed(2);
  console.log(`\n💾 Saved: ${outputFile}`);
  console.log(`   Size: ${fileSizeMB} MB`);
  console.log(`   Articles: ${allCategorized.length}`);

  // Compact index
  const compactIndex = allCategorized.map(a => ({
    id: a.id,
    code: a.code,
    article_number: a.article_number,
    title: a.title,
    unit_type: a.unit_type,
    categories: a.categories,
    tags: a.tags,
    importance: a.importance,
    text_length: a.text.length,
  }));
  const indexFile = path.join(OUTPUT_DIR, 'articles-index.json');
  fs.writeFileSync(indexFile, JSON.stringify(compactIndex, null, 2), 'utf-8');
  console.log(`   Index: articles-index.json (${compactIndex.length} entries)`);

  console.log(`\n  Наступний крок:`);
  console.log(`    node scripts/04-embed.js --dry-run     — перевірка chunks`);
  console.log(`    node scripts/04-embed.js               — upload до Pinecone`);
  console.log();
}

main();
