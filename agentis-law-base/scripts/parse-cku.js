#!/usr/bin/env node
/**
 * AGENTIS Law Database — Парсер ЦКУ
 * 
 * Що робить:
 * 1. Читає cku.txt (весь текст Цивільного кодексу)
 * 2. Знаходить кожну статтю
 * 3. Витягує номер, назву, текст
 * 4. Визначає до якої книги/розділу/глави належить
 * 5. Зберігає у структурований JSON
 * 
 * Запуск: node scripts/parse-cku.js
 */

const fs = require('fs');
const path = require('path');

// === НАЛАШТУВАННЯ ===
const INPUT_FILE = path.join(__dirname, '..', 'data', 'raw', 'cku.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'parsed', 'cku-parsed.json');

// Створити папку якщо немає
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('📚 AGENTIS — Парсер Цивільного кодексу України');
console.log('================================================\n');

// === КРОК 1: Прочитати файл ===
console.log('📖 Читаю файл...');
const raw = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = raw.split('\n');
console.log(`   Рядків у файлі: ${lines.length}\n`);

// === КРОК 2: Пройтись по рядках, знайти структуру ===
console.log('🔍 Шукаю статті, книги, розділи, глави...\n');

let currentBook = '';      // "КНИГА ПЕРША ЗАГАЛЬНІ ПОЛОЖЕННЯ"
let currentSection = '';   // "Розділ I ОСНОВНІ ПОЛОЖЕННЯ"
let currentChapter = '';   // "Глава 1 ЦИВІЛЬНЕ ЗАКОНОДАВСТВО УКРАЇНИ"
let currentParagraph = ''; // "§ 2. Роздрібна купівля-продаж"

const articles = [];
let currentArticle = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // --- Знайшли КНИГУ ---
  // Формат: "КНИГА ПЕРША " (наступний рядок — назва великими)
  if (/^КНИГА\s/.test(trimmed)) {
    // Назва книги може бути на тому ж рядку або наступному
    const nextLine = (lines[i + 1] || '').trim();
    if (nextLine && /^[А-ЯІЇЄҐ\s]+$/.test(nextLine)) {
      currentBook = trimmed + ' ' + nextLine;
    } else {
      currentBook = trimmed;
    }
    currentSection = '';
    currentChapter = '';
    currentParagraph = '';
    continue;
  }

  // --- Знайшли РОЗДІЛ ---
  // Формат: "Розділ I " або "Розділ II" (наступний рядок — назва великими)
  if (/^Розділ\s+[IVXLC]+\s*/.test(trimmed)) {
    const nextLine = (lines[i + 1] || '').trim();
    if (nextLine && /^[А-ЯІЇЄҐ\s''.]+$/.test(nextLine)) {
      currentSection = trimmed + ' ' + nextLine;
    } else {
      currentSection = trimmed;
    }
    currentChapter = '';
    currentParagraph = '';
    continue;
  }

  // --- Знайшли ГЛАВУ ---
  // Формат: "Глава 1 " (наступний рядок — назва великими)
  if (/^Глава\s+\d+/.test(trimmed)) {
    const nextLine = (lines[i + 1] || '').trim();
    if (nextLine && /^[А-ЯІЇЄҐ\s''.()]+$/.test(nextLine)) {
      currentChapter = trimmed + ' ' + nextLine;
    } else {
      currentChapter = trimmed;
    }
    currentParagraph = '';
    continue;
  }

  // --- Знайшли ПАРАГРАФ ---
  // Формат: "§ 2. Роздрібна купівля-продаж"
  if (/^§\s*\d+/.test(trimmed)) {
    currentParagraph = trimmed;
    continue;
  }

  // --- Знайшли СТАТТЮ ---
  // Формат: "Стаття 626. Поняття та види договору"
  // Або:    "Стаття 48-1. Правові наслідки..."
  const articleMatch = trimmed.match(/^Стаття\s+(\d+(?:-\d+)?)\.\s*(.+)$/);
  if (articleMatch) {
    // Зберегти попередню статтю (якщо є)
    if (currentArticle) {
      currentArticle.text = cleanText(currentArticle.text);
      articles.push(currentArticle);
    }

    // Почати нову статтю
    currentArticle = {
      id: `ЦКУ-${articleMatch[1]}`,
      code: 'ЦКУ',
      article_number: articleMatch[1], // "626" або "48-1"
      title: articleMatch[2].trim(),
      text: '',
      book: currentBook,
      section: currentSection,
      chapter: currentChapter,
      paragraph: currentParagraph || undefined,
      source_url: `https://zakon.rada.gov.ua/laws/show/435-15#Text`,
      last_verified: new Date().toISOString().split('T')[0]
    };
    continue;
  }

  // --- Звичайний рядок (текст статті) ---
  if (currentArticle) {
    currentArticle.text += line + '\n';
  }
}

// Не забути останню статтю
if (currentArticle) {
  currentArticle.text = cleanText(currentArticle.text);
  articles.push(currentArticle);
}

// === КРОК 3: Очистити тексти ===
function cleanText(text) {
  return text
    // Прибрати порожні рядки на початку та кінці
    .trim()
    // Прибрати рядки що є заголовками наступної книги/розділу/глави
    // (вони потрапили в текст останньої статті перед ними)
    .replace(/\n(КНИГА\s.+)/g, '')
    .replace(/\n(Розділ\s+[IVXLC]+\s*)/g, '')
    .replace(/\n(Глава\s+\d+\s*)/g, '')
    // Прибрати зайві порожні рядки (більше 2 підряд → 1)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// === КРОК 4: Статистика ===
console.log(`✅ Знайдено статей: ${articles.length}\n`);

// Порахувати по книгах
const byBook = {};
for (const a of articles) {
  const bookShort = a.book.substring(0, 30) + '...';
  byBook[bookShort] = (byBook[bookShort] || 0) + 1;
}
console.log('📖 По книгах:');
for (const [book, count] of Object.entries(byBook)) {
  console.log(`   ${book}: ${count} статей`);
}

// Показати приклади
console.log('\n📋 Приклади (перші 3 статті):');
for (const a of articles.slice(0, 3)) {
  console.log(`\n   ${a.id}: ${a.title}`);
  console.log(`   Книга: ${a.book.substring(0, 40)}`);
  console.log(`   Глава: ${a.chapter.substring(0, 40)}`);
  console.log(`   Текст: ${a.text.substring(0, 80)}...`);
}

// Показати статтю 626 як контроль
const art626 = articles.find(a => a.article_number === '626');
if (art626) {
  console.log(`\n📋 Контрольна перевірка — Стаття 626:`);
  console.log(`   Назва: ${art626.title}`);
  console.log(`   Книга: ${art626.book.substring(0, 50)}`);
  console.log(`   Глава: ${art626.chapter}`);
  console.log(`   Текст (перші 150 символів):`);
  console.log(`   ${art626.text.substring(0, 150)}...`);
}

// === КРОК 5: Зберегти ===
const output = {
  code: 'ЦКУ',
  full_name: 'Цивільний кодекс України',
  document_id: '435-IV',
  source_url: 'https://zakon.rada.gov.ua/laws/show/435-15',
  parsed_date: new Date().toISOString().split('T')[0],
  total_articles: articles.length,
  articles: articles
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✅ ГОТОВО!`);
console.log(`📁 Збережено: data/parsed/cku-parsed.json`);
console.log(`📊 Всього: ${articles.length} статей`);
console.log(`📦 Розмір файлу: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);
