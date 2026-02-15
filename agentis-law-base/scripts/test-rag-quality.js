#!/usr/bin/env node
/**
 * AGENTIS — RAG Quality Test v2 (Two-Phase Search)
 * 
 * Тестує ДВОФАЗНИЙ семантичний пошук по розширеній базі (21k+ статей).
 * Імітує логіку law-rag-service.ts:
 *   Phase 1 (Broad): семантичний пошук по ВСІЙ базі, без фільтрів
 *   Phase 2 (Targeted): пошук з фільтром по core codes + legal anchor
 *   Merge → deduplicate → sort
 * 
 * Запуск:
 *   export OPENAI_API_KEY=sk-...
 *   export PINECONE_API_KEY=pcsk_...
 *   node scripts/test-rag-quality.js              — всі тести
 *   node scripts/test-rag-quality.js --verbose    — з повним виводом статей
 *   node scripts/test-rag-quality.js lease        — тільки один тип
 */

// ═══════════════════════════════════════
//  TWO-PHASE CONFIG (mirrors law-rag-service.ts)
// ═══════════════════════════════════════

const TWO_PHASE_CONFIG = {
  lease: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір найму оренди строк плата ремонт повернення',
    broadTopK: 12, targetedTopK: 10,
  },
  sale: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір купівлі-продажу ціна якість передача товару',
    broadTopK: 12, targetedTopK: 10,
  },
  employment: {
    coreCodes: ['КЗпП'],
    legalAnchor: 'Кодекс законів про працю трудовий договір прийняття звільнення оплата праці',
    broadTopK: 10, targetedTopK: 12,
  },
  service: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір послуг оплата послуг якість строк виконання зобовʼязання',
    broadTopK: 12, targetedTopK: 10,
  },
  nda: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс комерційна таємниця право інтелектуальної власності конфіденційна інформація охорона секрет виробництва нерозголошення договір штраф збитки',
    broadTopK: 12, targetedTopK: 10,
  },
  construction: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір будівельного підряду кошторис проектна документація гарантія якості',
    broadTopK: 12, targetedTopK: 10,
  },
  loan: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір позики кредиту проценти повернення забезпечення',
    broadTopK: 12, targetedTopK: 10,
  },
  corporate: {
    coreCodes: ['ЦКУ', 'ГКУ'],
    legalAnchor: 'Цивільний кодекс юридична особа товариство статут учасники статутний капітал',
    broadTopK: 12, targetedTopK: 10,
  },
};

// ═══════════════════════════════════════
//  TEST CASES
// ═══════════════════════════════════════

const TEST_QUERIES = [
  {
    name: 'lease',
    label: 'Договір оренди приміщення',
    query: 'Договір оренди офісного приміщення строком на 3 роки, орендна плата 50000 грн/міс, відповідальність сторін за пошкодження майна',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['оренд', 'найм', 'приміщ'],
    minResults: 5,
  },
  {
    name: 'sale',
    label: 'Договір купівлі-продажу',
    query: 'Договір купівлі-продажу квартири у місті Київ, ціна 2 мільйони гривень, нотаріальне посвідчення, перехід права власності',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['купівл', 'продаж', 'нерухом', 'власн'],
    minResults: 5,
  },
  {
    name: 'employment',
    label: 'Трудовий договір',
    query: 'Трудовий договір з програмістом, випробувальний строк 3 місяці, заробітна плата 80000 грн, дистанційна робота, NDA',
    expectedCodes: ['КЗпП'],
    expectedKeywords: ['трудов', 'праців', 'оплат', 'звільнен'],
    minResults: 5,
  },
  {
    name: 'service',
    label: 'Договір послуг',
    query: 'Договір надання юридичних послуг, консультації та представництво в суді, оплата погодинна 3000 грн/год, конфіденційність',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['послуг', 'оплат', 'якість'],
    minResults: 3,
  },
  {
    name: 'nda',
    label: 'NDA (нерозголошення)',
    query: 'Договір про нерозголошення конфіденційної інформації між ТОВ та фізичною особою, строк 5 років, штраф за порушення',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['конфіденц', 'таємн', 'відповідальн'],
    minResults: 3,
  },
  {
    name: 'construction',
    label: 'Договір будівельного підряду',
    query: 'Договір будівельного підряду на зведення житлового будинку, кошторис 5 млн грн, строк 18 місяців, гарантія якості 5 років',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['підряд', 'будівн', 'якість', 'гарант'],
    minResults: 3,
  },
  {
    name: 'loan',
    label: 'Договір позики',
    query: 'Договір позики грошових коштів 500000 грн під 18% річних строком на 1 рік, забезпечення порукою, штраф за прострочення',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['позик', 'кредит', 'процент', 'забезпечен'],
    minResults: 3,
  },
  {
    name: 'corporate',
    label: 'Корпоративний договір',
    query: 'Статут товариства з обмеженою відповідальністю, статутний капітал 100000 грн, двоє учасників по 50%, порядок прийняття рішень',
    expectedCodes: ['ЦКУ'],
    expectedKeywords: ['товариств', 'статут', 'учасник', 'капітал'],
    minResults: 3,
  },
];

// ═══════════════════════════════════════
//  PINECONE + OPENAI
// ═══════════════════════════════════════

const PINECONE_INDEX = 'agentis-law';
const PINECONE_NAMESPACE = 'ua-law-v1';
const EMBEDDING_MODEL = 'text-embedding-3-small';

let pineconeHost = null;

async function httpJson(method, url, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
  }
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : {};
}

async function getPineconeHost() {
  if (pineconeHost) return pineconeHost;
  const data = await httpJson('GET', 'https://api.pinecone.io/indexes', null, {
    'Api-Key': process.env.PINECONE_API_KEY,
  });
  const idx = (data.indexes || []).find(i => i.name === PINECONE_INDEX);
  if (!idx?.host) throw new Error(`Index "${PINECONE_INDEX}" not found`);
  pineconeHost = `https://${idx.host}`;
  return pineconeHost;
}

async function embed(text) {
  const data = await httpJson('POST', 'https://api.openai.com/v1/embeddings', {
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8000),
  }, { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` });
  return data.data[0].embedding;
}

async function search(vector, topK = 20, filter = null) {
  const host = await getPineconeHost();
  const body = {
    vector,
    topK,
    includeMetadata: true,
    namespace: PINECONE_NAMESPACE,
  };
  if (filter) body.filter = filter;
  const data = await httpJson('POST', `${host}/query`, body, {
    'Api-Key': process.env.PINECONE_API_KEY,
  });
  return data.matches || [];
}

// ═══════════════════════════════════════
//  TWO-PHASE SEARCH (mirrors law-rag-service.ts)
// ═══════════════════════════════════════

async function twoPhaseSearch(test) {
  const config = TWO_PHASE_CONFIG[test.name] || TWO_PHASE_CONFIG['service'];

  // Phase 1: Broad — semantic search across ALL laws, no filter
  const broadVector = await embed(test.query);
  const broadMatches = await search(broadVector, config.broadTopK * 2, null);

  // Phase 2: Targeted — filtered by coreCodes + legalAnchor query
  const targetedQuery = `${config.legalAnchor}\n\n${test.query}`;
  const targetedVector = await embed(targetedQuery);
  const targetedFilter = { code: { $in: config.coreCodes } };
  const targetedMatches = await search(targetedVector, config.targetedTopK * 2, targetedFilter);

  // Merge + deduplicate (same logic as law-rag-service.ts)
  const articleMap = new Map();
  const processMatches = (matches, phase) => {
    for (const match of matches) {
      if ((match.score || 0) < 0.25) continue;
      const meta = match.metadata || {};
      const articleId = meta.article_id || match.id.replace(/_chunk\d+$/, '');
      // Slight boost for targeted results to ensure core codes rank
      const effectiveScore = phase === 'targeted'
        ? (match.score || 0) + 0.02
        : (match.score || 0);
      if (!articleMap.has(articleId) || effectiveScore > articleMap.get(articleId).score) {
        articleMap.set(articleId, {
          score: effectiveScore,
          code: meta.code || '',
          articleNumber: meta.article_number || '',
          title: meta.title || '',
          unitType: meta.unit_type || 'стаття',
          importance: meta.importance || 'normal',
          phase,
        });
      }
    }
  };

  processMatches(broadMatches, 'broad');
  processMatches(targetedMatches, 'targeted');

  // Sort by score desc
  return Array.from(articleMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

// ═══════════════════════════════════════
//  TEST RUNNER
// ═══════════════════════════════════════

async function runTest(test, verbose) {
  process.stdout.write(`\n🔍 ${test.label}... `);

  const startMs = Date.now();
  const results = await twoPhaseSearch(test);
  const timeMs = Date.now() - startMs;

  const relevant = results.filter(r => r.score >= 0.25);
  const highRelevant = results.filter(r => r.score >= 0.40);
  const fromBroad = results.filter(r => r.phase === 'broad');
  const fromTargeted = results.filter(r => r.phase === 'targeted');

  // Check expected codes
  const foundCodes = new Set(relevant.map(r => r.code).filter(Boolean));
  const expectedFound = test.expectedCodes.filter(c => foundCodes.has(c));
  const codesOk = expectedFound.length === test.expectedCodes.length;

  // Check keywords in titles
  const allTitles = relevant.map(r => (r.title || '').toLowerCase()).join(' ');
  const keywordsFound = test.expectedKeywords.filter(kw => allTitles.includes(kw.toLowerCase()));
  const keywordsOk = keywordsFound.length >= Math.ceil(test.expectedKeywords.length * 0.5);

  // Count results
  const countOk = relevant.length >= test.minResults;

  // New laws (not just ЦКУ/КЗпП)
  const newLawCodes = [...foundCodes].filter(c => c !== 'ЦКУ' && c !== 'КЗпП');

  // Overall
  const passed = codesOk && keywordsOk && countOk;

  console.log(passed ? '✅ PASS' : '❌ FAIL', `(${timeMs}ms)`);

  console.log(`   Результатів: ${relevant.length} (score≥0.25), ${highRelevant.length} (score≥0.40) [мін: ${test.minResults}] ${countOk ? '✓' : '✗'}`);
  console.log(`   Кодекси: ${[...foundCodes].join(', ')} [потрібно: ${test.expectedCodes.join(', ')}] ${codesOk ? '✓' : '✗'}`);
  console.log(`   Ключові слова: ${keywordsFound.length}/${test.expectedKeywords.length} ${keywordsOk ? '✓' : '✗'}`);
  console.log(`   Фази: broad=${fromBroad.length}, targeted=${fromTargeted.length}`);
  if (newLawCodes.length > 0) {
    console.log(`   🆕 Нові закони: ${newLawCodes.join(', ')}`);
  }

  // Verbose: top results
  if (verbose) {
    console.log('   ───────────────────────────────────────');
    for (const r of relevant.slice(0, 10)) {
      const unit = r.unitType === 'пункт' ? `п.${r.articleNumber}` : `ст.${r.articleNumber}`;
      const phaseTag = r.phase === 'targeted' ? ' [T]' : ' [B]';
      console.log(`   ${Math.round(r.score * 100)}% ${r.code} ${unit}. ${(r.title || '').substring(0, 55)}${phaseTag}`);
    }
  }

  return { name: test.name, passed, relevant: relevant.length, highRelevant: highRelevant.length, timeMs, newLawCodes, fromBroad: fromBroad.length, fromTargeted: fromTargeted.length };
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const specificTest = args.find(a => !a.startsWith('--'));

  if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
    console.error('❌ Set OPENAI_API_KEY and PINECONE_API_KEY');
    process.exit(1);
  }

  console.log('═'.repeat(55));
  console.log('  AGENTIS — RAG Quality Test v2 (Two-Phase Search)');
  console.log('═'.repeat(55));

  // Pinecone stats
  const host = await getPineconeHost();
  const stats = await httpJson('POST', `${host}/describe_index_stats`, {}, {
    'Api-Key': process.env.PINECONE_API_KEY,
  });
  const nsVectors = stats.namespaces?.[PINECONE_NAMESPACE]?.vectorCount || 0;
  console.log(`\n📌 Pinecone: ${nsVectors} vectors in "${PINECONE_NAMESPACE}"`);

  // Filter tests
  const tests = specificTest
    ? TEST_QUERIES.filter(t => t.name === specificTest)
    : TEST_QUERIES;

  if (tests.length === 0) {
    console.error(`❌ Test "${specificTest}" not found. Available: ${TEST_QUERIES.map(t => t.name).join(', ')}`);
    process.exit(1);
  }

  // Run tests
  const results = [];
  for (const test of tests) {
    results.push(await runTest(test, verbose));
    await new Promise(r => setTimeout(r, 300));
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const allNewLaws = [...new Set(results.flatMap(r => r.newLawCodes))];
  const avgTime = Math.round(results.reduce((s, r) => s + r.timeMs, 0) / results.length);
  const avgBroad = Math.round(results.reduce((s, r) => s + r.fromBroad, 0) / results.length);
  const avgTargeted = Math.round(results.reduce((s, r) => s + r.fromTargeted, 0) / results.length);

  console.log('\n' + '═'.repeat(55));
  console.log('  РЕЗУЛЬТАТ');
  console.log('═'.repeat(55));
  console.log(`\n  ✅ Passed: ${passed}/${results.length}`);
  if (failed > 0) console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏱️  Avg time: ${avgTime}ms per query (2 embeddings + 2 searches)`);
  console.log(`  📊 Avg results: broad=${avgBroad}, targeted=${avgTargeted}`);
  if (allNewLaws.length > 0) {
    console.log(`  🆕 Non ЦКУ/КЗпП laws: ${allNewLaws.slice(0, 15).join(', ')}${allNewLaws.length > 15 ? '...' : ''}`);
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥', err.message);
  process.exit(1);
});
