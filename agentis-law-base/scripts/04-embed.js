#!/usr/bin/env node
/**
 * AGENTIS Law Database — Station 4: Embeddings + Pinecone Upload
 * 
 * Node.js version (zero dependencies, native fetch).
 * Replaces 04-embed-and-upload.py.
 * 
 * Reads:  data/categorized/all-articles-categorized.json
 * Writes: Pinecone index "agentis-law", namespace "ua-law-v1"
 * 
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   export PINECONE_API_KEY=pcsk_...
 *   node scripts/04-embed.js                  — embed + upload all
 *   node scripts/04-embed.js --dry-run        — chunk + count, no API calls
 *   node scripts/04-embed.js --stats          — show Pinecone stats only
 *   node scripts/04-embed.js --delete-all     — wipe namespace (careful!)
 * 
 * Env vars:
 *   OPENAI_API_KEY     — required for embeddings
 *   PINECONE_API_KEY   — required for upload
 *   PINECONE_INDEX     — index name (default: agentis-law)
 *   PINECONE_NAMESPACE — namespace (default: ua-law-v1)
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════

const INDEX_NAME = process.env.PINECONE_INDEX || 'agentis-law';
const NAMESPACE = process.env.PINECONE_NAMESPACE || 'ua-law-v1';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions, $0.02/1M tokens
const MAX_CHUNK_CHARS = 6000;  // ~1500 tokens for Ukrainian text
const BATCH_SIZE = 30;         // Vectors per Pinecone upsert
const EMBED_BATCH_SIZE = 30;   // Texts per OpenAI embedding call
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;
const INTER_BATCH_DELAY_MS = 300;

const SCRIPT_DIR = __dirname;
const DATA_DIR = path.join(SCRIPT_DIR, '..', 'data');
const INPUT_FILE = path.join(DATA_DIR, 'categorized', 'all-articles-categorized.json');

// ═══════════════════════════════════════
//  API HELPERS (native fetch)
// ═══════════════════════════════════════

function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('❌ OPENAI_API_KEY not set. Export it first.');
  return key;
}

function getPineconeKey() {
  const key = process.env.PINECONE_API_KEY;
  if (!key) throw new Error('❌ PINECONE_API_KEY not set. Export it first.');
  return key;
}

async function httpJson(method, url, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  opts.signal = controller.signal;

  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
    }
    return text.trim() ? JSON.parse(text) : {};
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function withRetry(fn, label, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      process.stdout.write(`[retry ${i + 1}/${attempts}]`);
      await sleep(RETRY_DELAY_MS * (i + 1));
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════
//  OPENAI EMBEDDINGS
// ═══════════════════════════════════════

async function embedTexts(texts) {
  const key = getOpenAIKey();
  const data = await httpJson('POST', 'https://api.openai.com/v1/embeddings', {
    model: EMBEDDING_MODEL,
    input: texts,
  }, { 'Authorization': `Bearer ${key}` });

  return {
    embeddings: data.data.map(d => d.embedding),
    tokens: data.usage?.total_tokens || 0,
  };
}

// ═══════════════════════════════════════
//  PINECONE
// ═══════════════════════════════════════

let _pineconeHost = null;

async function getPineconeHost() {
  if (_pineconeHost) return _pineconeHost;
  const key = getPineconeKey();
  const data = await httpJson('GET', 'https://api.pinecone.io/indexes', null, {
    'Api-Key': key,
  });
  const idx = (data.indexes || []).find(i => i.name === INDEX_NAME);
  if (!idx) {
    throw new Error(`Pinecone index "${INDEX_NAME}" not found. Create it first (1536 dims, cosine).`);
  }
  if (!idx.host) {
    throw new Error(`Pinecone index "${INDEX_NAME}" has no host. It may still be initializing.`);
  }
  _pineconeHost = `https://${idx.host}`;
  return _pineconeHost;
}

async function pineconeApi(method, endpoint, body) {
  const host = await getPineconeHost();
  const key = getPineconeKey();
  return httpJson(method, `${host}${endpoint}`, body, { 'Api-Key': key });
}

async function pineconeUpsert(vectors) {
  return pineconeApi('POST', '/vectors/upsert', {
    vectors,
    namespace: NAMESPACE,
  });
}

async function pineconeStats() {
  return pineconeApi('POST', '/describe_index_stats', {});
}

async function pineconeDeleteAll() {
  return pineconeApi('POST', '/vectors/delete', {
    deleteAll: true,
    namespace: NAMESPACE,
  });
}

// ═══════════════════════════════════════
//  CYRILLIC → ASCII ID (Pinecone requires ASCII IDs)
// ═══════════════════════════════════════

const CYR_TO_LAT = {
  'А':'A','Б':'B','В':'V','Г':'H','Ґ':'G','Д':'D','Е':'E','Є':'Ye',
  'Ж':'Zh','З':'Z','И':'Y','І':'I','Ї':'Yi','Й':'Y','К':'K','Л':'L',
  'М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U',
  'Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ь':'',
  'Ю':'Yu','Я':'Ya',
  'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye',
  'ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l',
  'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
  'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
  'ю':'yu','я':'ya', "'":"", "ʼ":"", "'":"",
};

function toAsciiId(str) {
  let result = '';
  for (const ch of str) {
    if (CYR_TO_LAT[ch] !== undefined) result += CYR_TO_LAT[ch];
    else if (/[\x20-\x7E]/.test(ch)) result += ch;
    else result += '_';
  }
  // Pinecone ID: alphanumeric + hyphen + underscore, max 512 chars
  return result.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 500);
}

// ═══════════════════════════════════════
//  CHUNKING
// ═══════════════════════════════════════

/**
 * Convert an article into one or more chunks for embedding.
 * Each chunk gets a header with article metadata for context.
 */
function articleToChunks(article) {
  const code = article.code || '';
  const num = article.article_number || '';
  const unitType = article.unit_type || 'стаття';
  const unitLabel = unitType === 'пункт' ? `п.${num}` : `Стаття ${num}`;
  const header = `${code} ${unitLabel}. ${article.title || ''}`;
  const fullText = `${header}\n\n${article.text || ''}`;

  // ASCII-safe ID for Pinecone
  const rawId = article.id || `${code}-${num}`;
  const safeId = toAsciiId(rawId);

  // Build metadata (Pinecone limits: string values, no nested objects)
  const meta = {
    article_id: rawId,  // original Cyrillic ID in metadata (OK there)
    code: code,
    article_number: num,
    unit_type: unitType,
    title: (article.title || '').substring(0, 200),
    chapter: article.chapter || '',
    section: article.section || '',
    book: article.book || '',
    categories: (article.categories || []).join(','),
    tags: (article.tags || []).join(','),
    importance: article.importance || 'normal',
    text_length: (article.text || '').length,
  };

  // Single chunk if short enough
  if (fullText.length <= MAX_CHUNK_CHARS) {
    return [{
      id: safeId,
      text: fullText,
      metadata: { ...meta, chunk_index: 0, total_chunks: 1 },
    }];
  }

  // Split long articles
  const chunks = [];
  const text = article.text || '';
  const maxLen = MAX_CHUNK_CHARS - header.length - 30;
  const overlap = 200;
  let start = 0;
  let idx = 0;

  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);

    // Break at sentence boundary
    if (end < text.length) {
      const dotPos = text.lastIndexOf('.', end);
      const nlPos = text.lastIndexOf('\n', end);
      const bp = Math.max(dotPos, nlPos);
      if (bp > start + maxLen * 0.5) {
        end = bp + 1;
      }
    }

    chunks.push({
      id: `${safeId}_chunk${idx}`,
      text: `${header} [ч.${idx + 1}]\n\n${text.substring(start, end).trim()}`,
      metadata: { ...meta, chunk_index: idx, total_chunks: 0 },
    });
    idx++;

    if (end >= text.length) break;

    // Advance with overlap, always move forward
    const newStart = end - overlap;
    start = newStart <= start ? start + 1 : newStart;
  }

  // Fill total_chunks
  for (const c of chunks) {
    c.metadata.total_chunks = chunks.length;
  }
  return chunks;
}

// ═══════════════════════════════════════
//  COMMANDS
// ═══════════════════════════════════════

async function showStats() {
  console.log('\n📊 Pinecone Index Stats\n');
  const host = await getPineconeHost();
  console.log(`  Host: ${host}`);
  console.log(`  Index: ${INDEX_NAME}`);
  console.log(`  Namespace: ${NAMESPACE}\n`);

  const stats = await pineconeStats();
  console.log(`  Total vectors: ${stats.totalVectorCount || 0}`);
  console.log(`  Dimension: ${stats.dimension || '?'}`);

  const ns = stats.namespaces || {};
  if (Object.keys(ns).length > 0) {
    console.log('\n  Namespaces:');
    for (const [name, info] of Object.entries(ns)) {
      console.log(`    "${name}": ${info.vectorCount || 0} vectors`);
    }
  }
  console.log();
}

async function deleteAll() {
  console.log(`\n🗑️  Deleting ALL vectors in namespace "${NAMESPACE}"...`);
  await pineconeDeleteAll();
  console.log('  ✅ Done\n');
}

function dryRun(articles) {
  console.log('\n🔍 Dry Run — Chunking Analysis\n');

  let totalChunks = 0;
  let maxChunks = 0;
  let maxChunksArticle = '';
  let totalChars = 0;

  for (const art of articles) {
    const chunks = articleToChunks(art);
    totalChunks += chunks.length;
    totalChars += chunks.reduce((s, c) => s + c.text.length, 0);
    if (chunks.length > maxChunks) {
      maxChunks = chunks.length;
      maxChunksArticle = `${art.code} ${art.article_number}`;
    }
  }

  const estimatedTokens = Math.round(totalChars / 4); // rough estimate for Ukrainian
  const estimatedCost = (estimatedTokens / 1_000_000) * 0.02;

  console.log(`  Articles:        ${articles.length}`);
  console.log(`  Total chunks:    ${totalChunks}`);
  console.log(`  Max chunks/art:  ${maxChunks} (${maxChunksArticle})`);
  console.log(`  Total chars:     ${totalChars.toLocaleString()}`);
  console.log(`  Est. tokens:     ~${estimatedTokens.toLocaleString()}`);
  console.log(`  Est. cost:       ~$${estimatedCost.toFixed(4)}`);
  console.log(`  Batches:         ${Math.ceil(totalChunks / BATCH_SIZE)}`);
  console.log();
}

// ═══════════════════════════════════════
//  MAIN: EMBED + UPLOAD
// ═══════════════════════════════════════

async function embedAndUpload(articles) {
  console.log('\n🚀 Embedding + Pinecone Upload\n');

  // 1. Chunk
  console.log('✂️  Chunking...');
  const allChunks = [];
  for (const art of articles) {
    allChunks.push(...articleToChunks(art));
  }
  console.log(`   ${allChunks.length} chunks from ${articles.length} articles\n`);

  // 2. Verify Pinecone
  console.log('📌 Pinecone...');
  const host = await getPineconeHost();
  console.log(`   ${host}\n`);

  // 3. Embed + upload in batches
  const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);
  let totalTokens = 0;
  let uploaded = 0;
  let errors = 0;

  console.log(`📡 ${allChunks.length} chunks in ${totalBatches} batches...\n`);

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  [${String(batchNum).padStart(3)}/${totalBatches}] `);

    try {
      // Embed
      const { embeddings, tokens } = await withRetry(
        () => embedTexts(batch.map(c => c.text)),
        'embed'
      );
      totalTokens += tokens;

      // Build vectors
      const vectors = batch.map((chunk, j) => ({
        id: chunk.id,
        values: embeddings[j],
        metadata: chunk.metadata,
      }));

      // Upload to Pinecone
      await withRetry(
        () => pineconeUpsert(vectors),
        'upsert'
      );

      uploaded += vectors.length;
      const cost = (totalTokens / 1_000_000) * 0.02;
      console.log(`✅ ${uploaded}/${allChunks.length} ($${cost.toFixed(4)})`);

    } catch (err) {
      errors++;
      console.log(`❌ Error: ${err.message.substring(0, 80)}`);
    }

    // Rate limit politeness
    await sleep(INTER_BATCH_DELAY_MS);
  }

  // 4. Final stats
  await sleep(3000); // Wait for Pinecone to settle
  console.log('\n' + '═'.repeat(50));
  console.log('  РЕЗУЛЬТАТ');
  console.log('═'.repeat(50));
  console.log();
  console.log(`  ✅ Uploaded:    ${uploaded} / ${allChunks.length} vectors`);
  console.log(`  ❌ Errors:      ${errors}`);
  console.log(`  📊 Tokens:      ${totalTokens.toLocaleString()}`);
  console.log(`  💰 Cost:        ~$${((totalTokens / 1_000_000) * 0.02).toFixed(4)}`);

  try {
    const stats = await pineconeStats();
    const ns = stats.namespaces?.[NAMESPACE];
    console.log(`  📌 Pinecone:    ${ns?.vectorCount || '?'} vectors in "${NAMESPACE}"`);
    console.log(`  📦 Total index: ${stats.totalVectorCount || '?'} vectors`);
  } catch (err) {
    console.log(`  📌 Pinecone:    (stats unavailable)`);
  }

  console.log();
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  console.log('═'.repeat(50));
  console.log('  AGENTIS — Embeddings + Pinecone Upload');
  console.log('═'.repeat(50));

  // --stats
  if (args.includes('--stats')) {
    await showStats();
    return;
  }

  // --delete-all
  if (args.includes('--delete-all')) {
    await deleteAll();
    return;
  }

  // Load articles
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`\n❌ Input file not found: ${INPUT_FILE}`);
    console.error('   Run first: node scripts/03-categorize.js');
    process.exit(1);
  }

  console.log(`\n📖 Loading ${INPUT_FILE}...`);
  const articles = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`   ${articles.length} articles loaded`);

  // Summary by code
  const byCodes = {};
  for (const art of articles) {
    byCodes[art.code] = (byCodes[art.code] || 0) + 1;
  }
  for (const [code, count] of Object.entries(byCodes)) {
    console.log(`   ${code}: ${count}`);
  }

  // --dry-run
  if (args.includes('--dry-run')) {
    dryRun(articles);
    return;
  }

  // Full run
  await embedAndUpload(articles);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
