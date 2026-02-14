/**
 * КЗпП (Кодекс законів про працю України) Parser
 * Parses the full text of the Labor Code from txt file into structured JSON
 * 
 * Structure: Глава (Chapter) → Стаття (Article)
 * No Books (Книга), Sections (Розділ), or Paragraphs (§) unlike ЦКУ
 */

const fs = require('fs');
const path = require('path');

// Input/output paths
const INPUT_FILE = path.join(__dirname, '..', 'data', 'raw', 'kzpp.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'parsed', 'kzpp-parsed.json');

// Read the file
const text = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = text.split('\n');

console.log(`📄 КЗпП file: ${lines.length} lines`);

// State tracking
let currentChapter = null;
let currentChapterTitle = null;
let articles = [];
let currentArticle = null;

// Regex patterns
const chapterRegex = /^(?:Глава|ГЛАВА)\s+([IVXLC][\-IVXLCАБВГД]*)\s*$/i;
const articleRegex = /^Стаття\s+([\d\-]+)\.\s*(.+)$/;

function cleanText(text) {
  return text
    // Remove editorial comments {Із змінами...}
    .replace(/\{[^}]*\}/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function saveCurrentArticle() {
  if (currentArticle) {
    const fullText = currentArticle.isExcluded 
      ? currentArticle.title  // For excluded articles, the title contains the exclusion info
      : cleanText(currentArticle.rawLines.join('\n'));
    
    if (fullText.length > 0) {
      articles.push({
        id: `kzpp_${currentArticle.number.replace(/-/g, '_')}`,
        code: 'КЗпП',
        article_number: currentArticle.number,
        title: currentArticle.title,
        text: fullText,
        chapter: currentChapter,
        chapter_title: currentChapterTitle,
        is_excluded: currentArticle.isExcluded,
        metadata: {
          source: 'zakon.rada.gov.ua',
          parsed_at: new Date().toISOString(),
          code_full_name: 'Кодекс законів про працю України'
        }
      });
    }
  }
}

// Parse line by line
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Skip empty lines
  if (!line) continue;
  
  // Check for Chapter header
  const chapterMatch = line.match(chapterRegex);
  if (chapterMatch) {
    currentChapter = chapterMatch[1].trim();
    
    // Next non-empty line should be the chapter title
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine) {
        // Chapter title is typically in ALL CAPS
        if (nextLine === nextLine.toUpperCase() && nextLine.length > 3 && !nextLine.match(articleRegex)) {
          currentChapterTitle = nextLine;
        }
        break;
      }
    }
    continue;
  }
  
  // Check for Article header
  const articleMatch = line.match(articleRegex);
  if (articleMatch) {
    // Save previous article
    saveCurrentArticle();
    
    const articleNumber = articleMatch[1];
    let title = articleMatch[2].trim();
    
    // Check if article is excluded
    const isExcluded = /виключено/.test(title);
    
    // For excluded articles, keep the original title with exclusion info
    // For active articles, clean the title
    const cleanedTitle = isExcluded ? title.replace(/[{}]/g, '').trim() : cleanText(title);
    
    currentArticle = {
      number: articleNumber,
      title: cleanedTitle,
      rawLines: [],
      isExcluded: isExcluded
    };
    
    // If excluded, the title contains the full info, no body needed
    if (!isExcluded) {
      // Don't add the header line to rawLines - the body starts from next lines
    }
    
    continue;
  }
  
  // If we're inside an article, accumulate text
  if (currentArticle && !currentArticle.isExcluded) {
    // Skip chapter title lines (ALL CAPS)
    if (line === line.toUpperCase() && line.length > 3 && !line.match(/^\d/)) {
      continue;
    }
    currentArticle.rawLines.push(line);
  }
}

// Save the last article
saveCurrentArticle();

// Stats
const activeArticles = articles.filter(a => !a.is_excluded);
const excludedArticles = articles.filter(a => a.is_excluded);

console.log(`\n✅ Parsing complete!`);
console.log(`📊 Total articles found: ${articles.length}`);
console.log(`   ├── Active: ${activeArticles.length}`);
console.log(`   └── Excluded (виключено): ${excludedArticles.length}`);

// Chapter breakdown
const chapters = {};
for (const article of articles) {
  const key = `${article.chapter} - ${article.chapter_title}`;
  if (!chapters[key]) chapters[key] = 0;
  chapters[key]++;
}

console.log(`\n📋 Articles by Chapter:`);
for (const [chapter, count] of Object.entries(chapters)) {
  console.log(`   Глава ${chapter}: ${count} articles`);
}

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2), 'utf-8');

const fileSizeMB = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
console.log(`\n💾 Output: ${OUTPUT_FILE}`);
console.log(`   Size: ${fileSizeMB} MB`);

// Quick verification - show a sample article
const sampleArticle = articles.find(a => a.article_number === '21' && !a.is_excluded);
if (sampleArticle) {
  console.log(`\n🔍 Sample - Стаття ${sampleArticle.article_number}: ${sampleArticle.title}`);
  console.log(`   Chapter: Глава ${sampleArticle.chapter} - ${sampleArticle.chapter_title}`);
  console.log(`   Text preview: ${sampleArticle.text.substring(0, 200)}...`);
}
