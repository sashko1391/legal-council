/**
 * Station 6: Law RAG Service — v2 (Universal, 21k+ articles)
 * 
 * FIX C1 (Feb 14): Replaced SDK with native fetch()
 * FIX H4 (Feb 14): Removed importanceFilter
 * FIX M3 (Feb 14): PINECONE_API_KEY validation
 * 
 * v2 Changes (Feb 15, 2026):
 *   - Expanded code type: any string (not just ЦКУ|КЗпП)
 *   - Expanded CONTRACT_TYPE_CATEGORIES for all contract types
 *   - Added topK=20 default (bigger base needs more results)
 *   - Added unit_type support (стаття/пункт) in formatArticlesForPrompt
 *   - Improved query preparation: extracts key legal terms
 * 
 * Usage:
 *   import { getLawContext } from '../../services/law-rag-service';
 *   const lawContext = await getLawContext(contractText, 'lease');
 */

import { logger } from '../utils/logger';

// ═══════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════

export interface RelevantArticle {
  id: string;
  code: string;
  articleNumber: string;
  title: string;
  text: string;
  unitType: string; // 'стаття' | 'пункт'
  categories: string[];
  tags: string[];
  importance: 'critical' | 'high' | 'normal';
  relevanceScore: number;
  chapterTitle: string;
  section: string;
}

export interface RAGSearchOptions {
  contractType?: string;
  topK?: number;
  minScore?: number;
  importanceFilter?: string[];
  codeFilter?: string[];
}

// ═══════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════

const PINECONE_INDEX = 'agentis-law';
const PINECONE_NAMESPACE = 'ua-law-v1';
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * TWO-PHASE SEARCH CONFIG
 * 
 * Phase 1 (Broad): Semantic search across ALL 21k+ articles, no filters.
 *   → Catches specialized laws (ЗОД for lease, ЗТВ for corporate, etc.)
 * 
 * Phase 2 (Targeted): Filtered by core codes + legal-anchor query.
 *   → Ensures foundational articles (ЦКУ for civil, КЗпП for labor) are present.
 * 
 * Results are merged and deduplicated.
 */

interface ContractTypeConfig {
  /** Core codes that MUST appear in results (Phase 2 filter) */
  coreCodes: string[];
  /** Legal anchor text prepended to Phase 2 query for better semantic match */
  legalAnchor: string;
  /** Split: how many results from Phase 1 (broad) vs Phase 2 (targeted) */
  broadTopK: number;
  targetedTopK: number;
}

const CONTRACT_TYPE_CONFIG: Record<string, ContractTypeConfig> = {
  sale: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір купівлі-продажу ціна якість передача товару',
    broadTopK: 12,
    targetedTopK: 10,
  },
  lease: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір найму оренди строк плата ремонт повернення',
    broadTopK: 12,
    targetedTopK: 10,
  },
  service: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір послуг оплата послуг якість строк виконання зобовʼязання',
    broadTopK: 12,
    targetedTopK: 10,
  },
  work: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір підряду виконання робіт кошторис якість строк здача',
    broadTopK: 12,
    targetedTopK: 10,
  },
  loan: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір позики кредиту проценти повернення забезпечення',
    broadTopK: 12,
    targetedTopK: 10,
  },
  storage: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір зберігання обовʼязки зберігача повернення речі',
    broadTopK: 12,
    targetedTopK: 10,
  },
  transportation: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір перевезення вантажу пасажирів відповідальність перевізника',
    broadTopK: 12,
    targetedTopK: 10,
  },
  insurance: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір страхування страхова сума премія випадок',
    broadTopK: 12,
    targetedTopK: 10,
  },
  agency: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір доручення комісії управління майном повноваження',
    broadTopK: 12,
    targetedTopK: 10,
  },
  partnership: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір спільна діяльність просте товариство внески розподіл',
    broadTopK: 12,
    targetedTopK: 10,
  },
  employment: {
    coreCodes: ['КЗпП'],
    legalAnchor: 'Кодекс законів про працю трудовий договір прийняття звільнення оплата праці',
    broadTopK: 10,
    targetedTopK: 12,
  },
  nda: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс комерційна таємниця право інтелектуальної власності конфіденційна інформація охорона секрет виробництва нерозголошення договір штраф збитки',
    broadTopK: 12,
    targetedTopK: 10,
  },
  corporate: {
    coreCodes: ['ЦКУ', 'ГКУ'],
    legalAnchor: 'Цивільний кодекс юридична особа товариство статут учасники статутний капітал',
    broadTopK: 12,
    targetedTopK: 10,
  },
  land: {
    coreCodes: ['ЦКУ', 'ЗКУ'],
    legalAnchor: 'Земельний кодекс Цивільний кодекс земельна ділянка оренда землі право власності',
    broadTopK: 12,
    targetedTopK: 10,
  },
  construction: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір будівельного підряду кошторис проектна документація гарантія якості',
    broadTopK: 12,
    targetedTopK: 10,
  },
  it: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс договір послуг інтелектуальна власність авторське право програмне забезпечення',
    broadTopK: 12,
    targetedTopK: 10,
  },
  procurement: {
    coreCodes: ['ЦКУ', 'ГКУ'],
    legalAnchor: 'Господарський кодекс Цивільний кодекс публічна закупівля договір поставки',
    broadTopK: 12,
    targetedTopK: 10,
  },
  general: {
    coreCodes: ['ЦКУ'],
    legalAnchor: 'Цивільний кодекс загальні положення про договір зобовʼязання сторони виконання',
    broadTopK: 14,
    targetedTopK: 8,
  },
};

// ═══════════════════════════════════════
//  NATIVE FETCH — PINECONE + OPENAI
// ═══════════════════════════════════════

let cachedPineconeHost: string | null = null;

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not found. RAG embedding disabled.');
  return key;
}

function getPineconeKey(): string {
  const key = process.env.PINECONE_API_KEY;
  if (!key) throw new Error('PINECONE_API_KEY not found. RAG search disabled.');
  return key;
}

async function getPineconeHost(): Promise<string> {
  if (cachedPineconeHost) return cachedPineconeHost;
  const res = await fetch('https://api.pinecone.io/indexes', {
    headers: { 'Api-Key': getPineconeKey() },
  });
  if (!res.ok) throw new Error(`Pinecone list indexes failed: ${res.status}`);
  const data = await res.json();
  const idx = (data.indexes || []).find((i: any) => i.name === PINECONE_INDEX);
  if (!idx?.host) throw new Error(`Pinecone index "${PINECONE_INDEX}" not found`);
  cachedPineconeHost = `https://${idx.host}`;
  return cachedPineconeHost;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getOpenAIKey()}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embedding failed: ${res.status} ${body.substring(0, 200)}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

async function queryPinecone(
  vector: number[],
  topK: number,
  filter?: Record<string, any> | null,
): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
  const host = await getPineconeHost();
  const body: Record<string, any> = {
    vector,
    topK,
    includeMetadata: true,
    namespace: PINECONE_NAMESPACE,
  };
  if (filter) body.filter = filter;

  const res = await fetch(`${host}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': getPineconeKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pinecone query failed: ${res.status} ${text.substring(0, 200)}`);
  }
  const data = await res.json();
  return data.matches || [];
}

// ═══════════════════════════════════════
//  CORE SEARCH — TWO-PHASE
// ═══════════════════════════════════════

/**
 * Two-phase RAG search:
 * 
 * Phase 1 (Broad): Semantic search across ALL laws, no filters.
 *   → Discovers specialized laws (ЗОД, ЗТВ, ЗАдв, etc.)
 *   → Uses contract text as-is for natural semantic match
 * 
 * Phase 2 (Targeted): Filtered by core codes (ЦКУ/КЗпП) + legal anchor query.
 *   → Ensures foundational civil/labor articles are always present
 *   → Uses legal-specific anchor text for better code-level match
 * 
 * Merge → deduplicate → sort by relevance + importance.
 */
export async function findRelevantArticles(
  contractText: string,
  options: RAGSearchOptions = {}
): Promise<RelevantArticle[]> {
  const {
    contractType = 'general',
    topK = 20,
    minScore = 0.25,
    importanceFilter,
    codeFilter,
  } = options;

  const config = CONTRACT_TYPE_CONFIG[contractType] || CONTRACT_TYPE_CONFIG['general'];

  // ─── PHASE 1: Broad semantic search (all laws) ───
  const broadQuery = prepareQueryText(contractText, contractType);
  const broadEmbedding = await generateEmbedding(broadQuery);
  
  const broadFilter = buildBaseFilter(importanceFilter, codeFilter);
  const broadMatches = await queryPinecone(
    broadEmbedding,
    config.broadTopK * 2,  // fetch extra for dedup
    broadFilter
  );

  // ─── PHASE 2: Targeted search (core codes only) ───
  const targetedQuery = `${config.legalAnchor}\n\n${contractText.substring(0, 3000)}`;
  const targetedEmbedding = await generateEmbedding(targetedQuery.substring(0, 8000));

  const targetedFilter = buildTargetedFilter(config.coreCodes, importanceFilter);
  const targetedMatches = await queryPinecone(
    targetedEmbedding,
    config.targetedTopK * 2,
    targetedFilter
  );

  // ─── MERGE + DEDUPLICATE ───
  const articleMap = new Map<string, RelevantArticle>();

  const processMatches = (matches: Array<{ id: string; score: number; metadata: Record<string, any> }>, phase: 'broad' | 'targeted') => {
    for (const match of matches) {
      if ((match.score || 0) < minScore) continue;

      const meta = match.metadata;
      const articleId = meta.article_id || match.id.replace(/_chunk\d+$/, '');

      // Slight boost for targeted results (core code articles) to ensure they rank
      const effectiveScore = phase === 'targeted'
        ? (match.score || 0) + 0.02
        : (match.score || 0);

      if (!articleMap.has(articleId) || effectiveScore > articleMap.get(articleId)!.relevanceScore) {
        articleMap.set(articleId, {
          id: articleId,
          code: meta.code || '',
          articleNumber: meta.article_number || '',
          title: meta.title || '',
          text: '',
          unitType: meta.unit_type || 'стаття',
          categories: (meta.categories || '').split(',').filter(Boolean),
          tags: (meta.tags || '').split(',').filter(Boolean),
          importance: (meta.importance as any) || 'normal',
          relevanceScore: effectiveScore,
          chapterTitle: meta.chapter || '',
          section: meta.section || '',
        });
      }
    }
  };

  processMatches(broadMatches, 'broad');
  processMatches(targetedMatches, 'targeted');

  // ─── SORT: relevance → importance ───
  const importanceOrder: Record<string, number> = { critical: 0, high: 1, normal: 2 };
  return Array.from(articleMap.values())
    .sort((a, b) => {
      const scoreDiff = b.relevanceScore - a.relevanceScore;
      if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
      return (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2);
    })
    .slice(0, topK);
}

// ═══════════════════════════════════════
//  QUERY PREPARATION
// ═══════════════════════════════════════

function prepareQueryText(contractText: string, contractType: string): string {
  let query = '';

  const typeLabels: Record<string, string> = {
    sale: 'Договір купівлі-продажу',
    lease: 'Договір оренди (найму)',
    service: 'Договір надання послуг',
    work: 'Договір підряду',
    loan: 'Договір позики / кредиту',
    employment: 'Трудовий договір',
    nda: 'Договір про нерозголошення',
    corporate: 'Корпоративний договір',
    construction: 'Договір будівельного підряду',
    it: 'Договір розробки / IT послуг',
    land: 'Договір оренди / купівлі-продажу землі',
    procurement: 'Договір публічної закупівлі',
    storage: 'Договір зберігання',
    transportation: 'Договір перевезення',
    insurance: 'Договір страхування',
    agency: 'Договір доручення / комісії',
    partnership: 'Договір про спільну діяльність',
    general: 'Цивільно-правовий договір',
  };

  query += `${typeLabels[contractType] || 'Договір'}\n\n`;

  // Smart extraction: take beginning + liability/termination sections
  if (contractText.length > 4000) {
    query += contractText.substring(0, 3000);
    // Look for key sections
    const lowerText = contractText.toLowerCase();
    for (const keyword of ['відповідальність', 'розірвання', 'строк', 'оплата', 'форс-мажор']) {
      const idx = lowerText.indexOf(keyword);
      if (idx > 3000) {
        query += '\n...\n' + contractText.substring(idx, idx + 800);
        break;
      }
    }
  } else {
    query += contractText;
  }

  return query.substring(0, 8000);
}

// ═══════════════════════════════════════
//  FILTER BUILDERS
// ═══════════════════════════════════════

/**
 * Phase 1 filter: only user-specified filters (importance, explicit code).
 * No automatic code/category restrictions — let semantic search find anything.
 */
function buildBaseFilter(
  importanceFilter?: string[],
  codeFilter?: string[],
): Record<string, any> | null {
  const conditions: Record<string, any>[] = [];

  if (importanceFilter && importanceFilter.length > 0) {
    conditions.push({ importance: { $in: importanceFilter } });
  }
  if (codeFilter && codeFilter.length > 0) {
    conditions.push({ code: { $in: codeFilter } });
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

/**
 * Phase 2 filter: restrict to core codes (ЦКУ, КЗпП, etc.)
 * to ensure foundational articles appear in results.
 */
function buildTargetedFilter(
  coreCodes: string[],
  importanceFilter?: string[],
): Record<string, any> | null {
  const conditions: Record<string, any>[] = [];

  // Always filter by core codes
  conditions.push({ code: { $in: coreCodes } });

  if (importanceFilter && importanceFilter.length > 0) {
    conditions.push({ importance: { $in: importanceFilter } });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

// ═══════════════════════════════════════
//  PROMPT FORMATTER
// ═══════════════════════════════════════

export function formatArticlesForPrompt(articles: RelevantArticle[]): string {
  if (articles.length === 0) {
    return '<relevant_law_articles>\nНе знайдено релевантних статей.\n</relevant_law_articles>';
  }

  let prompt = '<relevant_law_articles>\n';
  prompt += `Знайдено ${articles.length} релевантних норм законодавства:\n\n`;

  for (const art of articles) {
    const scorePercent = Math.round(art.relevanceScore * 100);
    const importanceEmoji = art.importance === 'critical' ? '🔴' : art.importance === 'high' ? '🟡' : '⚪';
    const unitLabel = art.unitType === 'пункт' ? `п.${art.articleNumber}` : `Стаття ${art.articleNumber}`;

    prompt += `--- ${art.code} ${unitLabel} ---\n`;
    prompt += `Назва: ${art.title}\n`;
    prompt += `Важливість: ${importanceEmoji} ${art.importance} | Релевантність: ${scorePercent}%\n`;
    if (art.chapterTitle) {
      prompt += `Розділ: ${art.chapterTitle}\n`;
    }
    if (art.section) {
      prompt += `Секція: ${art.section}\n`;
    }
    if (art.tags.length > 0) {
      prompt += `Теги: ${art.tags.join(', ')}\n`;
    }
    prompt += '\n';
  }

  prompt += '</relevant_law_articles>';
  return prompt;
}

// ═══════════════════════════════════════
//  CONVENIENCE: FULL PIPELINE
// ═══════════════════════════════════════

/**
 * Complete RAG pipeline: search + format for prompt.
 * Now supports all contract types and 200+ laws.
 */
export async function getLawContext(
  contractText: string,
  contractType?: string,
): Promise<string> {
  try {
    const articles = await findRelevantArticles(contractText, {
      contractType: contractType || 'general',
      topK: 15,
      minScore: 0.25,
    });

    return formatArticlesForPrompt(articles);
  } catch (error) {
    logger.error('[LAW RAG] Error searching articles:', error);
    return '<relevant_law_articles>\nПомилка пошуку статей. Використовуйте загальні знання.\n</relevant_law_articles>';
  }
}

// ═══════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════

export async function checkRAGHealth(): Promise<{
  ok: boolean;
  pineconeVectors: number;
  error?: string;
}> {
  try {
    const host = await getPineconeHost();
    const res = await fetch(`${host}/describe_index_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': getPineconeKey(),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Pinecone stats failed: ${res.status}`);
    const stats = await res.json();
    const nsCount = stats.namespaces?.[PINECONE_NAMESPACE]?.vectorCount || 0;
    return { ok: nsCount > 0, pineconeVectors: nsCount };
  } catch (error: any) {
    return { ok: false, pineconeVectors: 0, error: error.message };
  }
}
