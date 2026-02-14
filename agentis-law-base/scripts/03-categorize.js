/**
 * Station 3: Категоризація статей
 * 
 * Додає категорії, теги та пріоритет до кожної статті
 * на основі структури кодексу (книга/глава) та ключових слів.
 * 
 * FIX M1 (Feb 14, 2026): Added article-number-range fallback
 *   — Chapter 58 (ст. 810-826) was categorized as 'loan' instead of 'lease'
 *   — Root cause: chapter extraction regex failed for some parsed articles
 *   — Fix: explicit article-number ranges as safety net
 * 
 * Запуск: node scripts/03-categorize.js
 * Вхід:  data/parsed/cku-parsed.json + data/parsed/kzpp-parsed.json
 * Вихід: data/categorized/all-articles-categorized.json
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  CONTRACT TYPE CATEGORIES
// ═══════════════════════════════════════════

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
  obligations_general: 'Загальні положення зобов\'язань',
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
};

// ═══════════════════════════════════════════
//  ЦКУ MAPPING: Book + Chapter → Categories
// ═══════════════════════════════════════════

const CKU_BOOK_CATEGORIES = {
  '1': ['persons'],
  '2': ['personal_rights'],
  '3': ['property'],
  '4': ['intellectual_property'],
  '5': ['obligations_general'],
  '6': ['inheritance'],
};

const CKU_CHAPTER_CATEGORIES = {
  // Book 5: Obligations
  '47': ['obligations_general'],
  '48': ['obligations_general'],
  '49': ['obligations_general'],
  '50': ['obligations_general'],
  '51': ['liability'],
  '52': ['general_contract'],
  '53': ['general_contract'],
  '54': ['sale'],
  '55': ['sale'],
  '56': ['sale'],
  '57': ['lease'],
  '58': ['lease'],          // FIX M1: was already 'lease' in map, but regex missed it
  '59': ['loan'],
  '60': ['storage'],
  '61': ['work'],
  '62': ['work'],
  '63': ['service'],
  '64': ['transportation'],
  '65': ['storage'],
  '66': ['insurance'],
  '67': ['agency'],
  '68': ['agency'],
  '69': ['agency'],
  '70': ['loan'],
  '71': ['loan'],
  '72': ['loan'],
  '73': ['loan'],
  '74': ['partnership'],
  '75': ['general_contract'],
  '76': ['liability'],
  '77': ['liability'],
  // Book 1
  '3': ['persons'],
  '4': ['persons'],
  '5': ['persons'],
  '7': ['persons'],
  '8': ['persons'],
  '18': ['persons'],
  '19': ['persons'],
};

// ═══════════════════════════════════════════
//  FIX M1: Article-number-range fallback
//  Safety net for when chapter regex fails
// ═══════════════════════════════════════════

const CKU_ARTICLE_RANGE_CATEGORIES = [
  { from: 626, to: 654, categories: ['general_contract'] },
  { from: 655, to: 711, categories: ['sale'] },
  { from: 717, to: 730, categories: ['sale'] },       // Дарування
  { from: 731, to: 743, categories: ['sale'] },       // Рента
  { from: 759, to: 809, categories: ['lease'] },      // Ch. 57 Найм (оренда)
  { from: 810, to: 826, categories: ['lease'] },      // Ch. 58 Найм житла ← FIX M1
  { from: 827, to: 836, categories: ['loan'] },       // Ch. 59 Позичка
  { from: 837, to: 891, categories: ['work'] },       // Ch. 61 Підряд
  { from: 901, to: 907, categories: ['service'] },    // Ch. 63 Послуги
  { from: 908, to: 935, categories: ['transportation'] },
  { from: 936, to: 978, categories: ['storage'] },
  { from: 979, to: 999, categories: ['insurance'] },
  { from: 1000, to: 1045, categories: ['agency'] },
  { from: 1046, to: 1097, categories: ['loan'] },     // Ch. 70-73
  { from: 1166, to: 1215, categories: ['liability'] },
];

function getCategoriesByArticleRange(articleNumber) {
  const num = parseInt(articleNumber, 10);
  if (isNaN(num)) return null;
  for (const range of CKU_ARTICLE_RANGE_CATEGORIES) {
    if (num >= range.from && num <= range.to) {
      return range.categories;
    }
  }
  return null;
}

// ═══════════════════════════════════════════
//  КЗпП MAPPING: Chapter → Categories
// ═══════════════════════════════════════════

const KZPP_CHAPTER_CATEGORIES = {
  'I': ['employment'],
  'II': ['collective_agreement'],
  'III': ['employment', 'employment_termination'],
  'III-А': ['employment_termination'],
  'III-Б': ['simplified_labor'],
  'IV': ['working_time'],
  'V': ['working_time'],
  'VI': ['wages'],
  'VII': ['wages'],
  'VIII': ['employment'],
  'IX': ['material_liability'],
  'X': ['labor_discipline'],
  'XI': ['labor_protection'],
  'XI-А': ['domestic_workers'],
  'XII': ['women_youth'],
  'XIII': ['women_youth'],
  'XIV': ['education_benefits'],
  'XV': ['labor_disputes'],
  'XVI': ['employment'],
  'XVI-А': ['employment'],
  'XVII': ['social_insurance'],
  'XVIII': ['labor_protection'],
  'XIX': ['employment'],
};

// ═══════════════════════════════════════════
//  IMPORTANCE / PRIORITY RULES
// ═══════════════════════════════════════════

const CRITICAL_CKU_ARTICLES = new Set([
  '203', '215', '216', '217', '218', '229', '230', '231', '232', '233', '234',
  '509', '525', '526', '527', '530', '533', '546', '549', '550', '551',
  '610', '611', '612', '613', '614', '615', '616', '617', '623', '624',
  '626', '627', '628', '629', '631', '632', '638', '639', '640', '641',
  '642', '643', '651', '652', '653', '654',
  '655', '656', '662', '665', '668', '669', '670', '671', '672',
  '759', '760', '762', '763', '773', '774',
  '810', '813', '815', '825',  // FIX M1: Added critical housing lease articles
  '837', '839', '843', '846', '849',
  '901', '902', '903', '905',
  '1046', '1054', '1057',
]);

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

// ═══════════════════════════════════════════
//  KEYWORD-BASED TAGGING
// ═══════════════════════════════════════════

const KEYWORD_TAGS = [
  { keywords: ['істотні умови', 'істотних умов', 'предмет договору'], tag: 'essential_terms' },
  { keywords: ['недійсн', 'нікчемн', 'оспорюван'], tag: 'invalidity' },
  { keywords: ['відповідальність', 'штраф', 'пеня', 'неустойк', 'збитк'], tag: 'liability' },
  { keywords: ['строк', 'термін', 'давність'], tag: 'deadlines' },
  { keywords: ['розірван', 'припинен', 'скасуван'], tag: 'termination' },
  { keywords: ['форма договору', 'письмова форма', 'нотаріальн'], tag: 'form_requirements' },
  { keywords: ['гарантія', 'забезпечен', 'заставу', 'порук', 'завдат'], tag: 'guarantees' },
  { keywords: ['ціна', 'оплат', 'розрахунк', 'плат'], tag: 'payment' },
  { keywords: ['передач', 'приймання', 'акт'], tag: 'delivery' },
  { keywords: ['якість', 'недолік', 'дефект', 'гарантійн'], tag: 'quality' },
  { keywords: ['звільнен', 'вивільнен', 'скороченн'], tag: 'dismissal' },
  { keywords: ['відпустк'], tag: 'vacation' },
  { keywords: ['випробуванн'], tag: 'probation' },
  { keywords: ['дискримінац', 'мобінг', 'цькуванн'], tag: 'discrimination' },
  { keywords: ['вагітн', 'жінк', 'материнств'], tag: 'maternity' },
  { keywords: ['неповнолітн', 'молод'], tag: 'youth_labor' },
  { keywords: ['конфіденцій', 'комерційна таємниця'], tag: 'confidentiality' },
  { keywords: ['форс-мажор', 'непереборн', 'непередбачуван'], tag: 'force_majeure' },
];

// ═══════════════════════════════════════════
//  MAIN PROCESSING
// ═══════════════════════════════════════════

function categorizeArticle(article) {
  let categories = [];
  let tags = [];
  let importance = 'normal';

  if (article.code === 'ЦКУ') {
    const chapterStr = article.chapter || '';
    const chapterNumMatch = chapterStr.match(/Глава\s+(\d+)/i);
    const chapterNum = chapterNumMatch ? chapterNumMatch[1] : null;

    const bookStr = article.book || '';
    let bookNum = null;
    if (bookStr.includes('ПЕРША')) bookNum = '1';
    else if (bookStr.includes('ДРУГА')) bookNum = '2';
    else if (bookStr.includes('ТРЕТЯ')) bookNum = '3';
    else if (bookStr.includes('ЧЕТВЕРТА')) bookNum = '4';
    else if (bookStr.includes("П'ЯТА")) bookNum = '5';
    else if (bookStr.includes('ШОСТА')) bookNum = '6';

    // 1. Categories: Article range (most reliable) → Chapter → Book fallback
    // FIX M1: Range check runs FIRST because parser sometimes assigns wrong
    // chapter to articles (e.g. ст.810-826 got chapter 59 instead of 58)
    const rangeCats = getCategoriesByArticleRange(article.article_number);
    if (rangeCats) {
      categories = [...rangeCats];
    } else if (chapterNum && CKU_CHAPTER_CATEGORIES[chapterNum]) {
      categories = [...CKU_CHAPTER_CATEGORIES[chapterNum]];
    } else if (bookNum && CKU_BOOK_CATEGORIES[bookNum]) {
      categories = [...CKU_BOOK_CATEGORIES[bookNum]];
    }

    // 2. Importance
    if (CRITICAL_CKU_ARTICLES.has(article.article_number)) {
      importance = 'critical';
    } else if (bookNum === '5') {
      importance = 'high';
    }

  } else if (article.code === 'КЗпП') {
    const chapter = article.chapter;
    if (chapter && KZPP_CHAPTER_CATEGORIES[chapter]) {
      categories = [...KZPP_CHAPTER_CATEGORIES[chapter]];
    }

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
  }

  // 3. Keyword-based tags
  const textToSearch = `${article.title || ''} ${article.text || ''}`.toLowerCase();
  for (const { keywords, tag } of KEYWORD_TAGS) {
    if (keywords.some(kw => textToSearch.includes(kw))) {
      tags.push(tag);
    }
  }

  // 4. Default categories
  if (categories.length === 0) {
    categories = article.code === 'ЦКУ' ? ['general_contract'] : ['employment'];
  }

  return {
    categories: [...new Set(categories)],
    tags: [...new Set(tags)],
    importance,
  };
}

// ═══════════════════════════════════════════
//  LOAD & PROCESS
// ═══════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'data');

const ckuRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'parsed', 'cku-parsed.json'), 'utf-8'));
const ckuArticles = ckuRaw.articles || ckuRaw;

const kzppArticles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'parsed', 'kzpp-parsed.json'), 'utf-8'));

console.log(`📖 Loaded ЦКУ: ${ckuArticles.length} articles`);
console.log(`📖 Loaded КЗпП: ${kzppArticles.length} articles`);

const activeKzpp = kzppArticles.filter(a => !a.is_excluded);
console.log(`   КЗпП active: ${activeKzpp.length}`);

const allCategorized = [];

for (const art of ckuArticles) {
  const { categories, tags, importance } = categorizeArticle(art);
  allCategorized.push({
    id: `cku_${art.article_number.replace(/-/g, '_')}`,
    code: 'ЦКУ',
    article_number: art.article_number,
    title: art.title || '',
    text: art.text || '',
    book: art.book || null,
    book_title: art.book_title || null,
    section: art.section || null,
    chapter: art.chapter || null,
    chapter_title: art.chapter_title || null,
    paragraph: art.paragraph || null,
    categories,
    tags,
    importance,
    metadata: {
      code_full_name: 'Цивільний кодекс України',
      source: 'zakon.rada.gov.ua',
      categorized_at: new Date().toISOString(),
    }
  });
}

for (const art of activeKzpp) {
  const { categories, tags, importance } = categorizeArticle(art);
  allCategorized.push({
    id: art.id || `kzpp_${art.article_number.replace(/-/g, '_')}`,
    code: 'КЗпП',
    article_number: art.article_number,
    title: art.title || '',
    text: art.text || '',
    book: null,
    book_title: null,
    section: null,
    chapter: art.chapter || null,
    chapter_title: art.chapter_title || null,
    paragraph: null,
    categories,
    tags,
    importance,
    metadata: {
      code_full_name: 'Кодекс законів про працю України',
      source: 'zakon.rada.gov.ua',
      categorized_at: new Date().toISOString(),
    }
  });
}

// ═══════════════════════════════════════════
//  STATISTICS
// ═══════════════════════════════════════════

console.log('\n═══════════════════════════════════════════');
console.log('  CATEGORIZATION RESULTS');
console.log('═══════════════════════════════════════════\n');
console.log(`Total articles: ${allCategorized.length}`);

const byCrit = allCategorized.filter(a => a.importance === 'critical').length;
const byHigh = allCategorized.filter(a => a.importance === 'high').length;
const byNorm = allCategorized.filter(a => a.importance === 'normal').length;
console.log(`\n📊 By importance:`);
console.log(`  🔴 Critical: ${byCrit}`);
console.log(`  🟡 High:     ${byHigh}`);
console.log(`  ⚪ Normal:   ${byNorm}`);

const catCounts = {};
for (const art of allCategorized) {
  for (const cat of art.categories) {
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
}
const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
console.log(`\n📋 By category (top 15):`);
for (const [cat, count] of sortedCats.slice(0, 15)) {
  const label = CATEGORIES[cat] || cat;
  console.log(`  ${cat.padEnd(25)} ${String(count).padStart(4)} articles  (${label})`);
}

const tagCounts = {};
for (const art of allCategorized) {
  for (const tag of art.tags) {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
}
const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
console.log(`\n🏷️  By tag (top 10):`);
for (const [tag, count] of sortedTags.slice(0, 10)) {
  console.log(`  ${tag.padEnd(20)} ${String(count).padStart(4)} articles`);
}

// FIX M1: Verify Chapter 58 articles are correctly categorized
const ch58Check = allCategorized.filter(a => {
  const num = parseInt(a.article_number, 10);
  return a.code === 'ЦКУ' && num >= 810 && num <= 826;
});
const ch58Wrong = ch58Check.filter(a => !a.categories.includes('lease'));
if (ch58Wrong.length > 0) {
  console.warn(`\n⚠️  FIX M1 FAILED: ${ch58Wrong.length} articles in 810-826 NOT categorized as 'lease':`);
  for (const a of ch58Wrong) {
    console.warn(`   ст.${a.article_number}: ${a.categories.join(', ')}`);
  }
} else {
  console.log(`\n✅ FIX M1: All ${ch58Check.length} articles in 810-826 correctly categorized as 'lease'`);
}

// ═══════════════════════════════════════════
//  SAVE OUTPUT
// ═══════════════════════════════════════════

const outputDir = path.join(DATA_DIR, 'categorized');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputFile = path.join(outputDir, 'all-articles-categorized.json');
fs.writeFileSync(outputFile, JSON.stringify(allCategorized, null, 2), 'utf-8');

const fileSizeMB = (fs.statSync(outputFile).size / (1024 * 1024)).toFixed(2);
console.log(`\n💾 Saved: ${outputFile}`);
console.log(`   Size: ${fileSizeMB} MB`);
console.log(`   Articles: ${allCategorized.length}`);

const compactIndex = allCategorized.map(a => ({
  id: a.id,
  code: a.code,
  article_number: a.article_number,
  title: a.title,
  categories: a.categories,
  tags: a.tags,
  importance: a.importance,
  text_length: a.text.length,
}));
fs.writeFileSync(
  path.join(outputDir, 'articles-index.json'),
  JSON.stringify(compactIndex, null, 2),
  'utf-8'
);
console.log(`   Index: articles-index.json (${compactIndex.length} entries)`);
