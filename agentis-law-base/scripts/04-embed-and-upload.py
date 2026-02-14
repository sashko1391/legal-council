#!/usr/bin/env python3
"""
Station 4+5: Embeddings + Pinecone Upload
Python, zero dependencies (only stdlib).

Run:
  export OPENAI_API_KEY=sk-...
  export PINECONE_API_KEY=pcsk_...
  python3 scripts/04-embed-and-upload.py
"""

import json, os, sys, time, urllib.request, urllib.error

OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '')
PINECONE_KEY = os.environ.get('PINECONE_API_KEY', '')

INDEX_NAME = 'agentis-law'
NAMESPACE = 'ua-law-v1'
MAX_CHUNK = 6000
BATCH_SIZE = 30

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, '..', 'data', 'categorized', 'all-articles-categorized.json')


def http_json(method, url, body=None, headers=None):
    hdrs = {'Content-Type': 'application/json'}
    if headers:
        hdrs.update(headers)
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            text = resp.read().decode('utf-8')
            return json.loads(text) if text.strip() else {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')[:300]
        raise Exception(f"HTTP {e.code}: {error_body}")


def openai_embed(texts):
    return http_json('POST', 'https://api.openai.com/v1/embeddings',
        body={'model': 'text-embedding-3-small', 'input': texts},
        headers={'Authorization': f'Bearer {OPENAI_KEY}'})


def pinecone_api(method, url, body=None):
    return http_json(method, url, body=body, headers={'Api-Key': PINECONE_KEY})


def ensure_pinecone_index():
    indexes = pinecone_api('GET', 'https://api.pinecone.io/indexes')
    idx = next((i for i in (indexes.get('indexes') or []) if i['name'] == INDEX_NAME), None)
    if not idx:
        print('  Creating Pinecone index (wait ~60s)...')
        try:
            pinecone_api('POST', 'https://api.pinecone.io/indexes', {
                'name': INDEX_NAME, 'dimension': 1536, 'metric': 'cosine',
                'spec': {'serverless': {'cloud': 'aws', 'region': 'us-east-1'}}
            })
        except Exception as e:
            if '409' not in str(e): raise
        for _ in range(12):
            time.sleep(10)
            sys.stdout.write('.')
            sys.stdout.flush()
            check = pinecone_api('GET', 'https://api.pinecone.io/indexes')
            idx = next((i for i in (check.get('indexes') or []) if i['name'] == INDEX_NAME), None)
            if idx and idx.get('status', {}).get('ready'): break
        print(' Ready')
    if not idx or not idx.get('host'):
        raise Exception('Could not get Pinecone host')
    return f"https://{idx['host']}"


def article_to_chunks(art):
    header = f"{art['code']} Стаття {art['article_number']}. {art.get('title', '')}"
    full = f"{header}\n\n{art.get('text', '')}"
    meta = {
        'article_id': art['id'], 'code': art['code'],
        'article_number': art['article_number'],
        'title': (art.get('title') or '')[:200],
        'chapter': art.get('chapter') or '',
        'chapter_title': (art.get('chapter_title') or '')[:200],
        'categories': ','.join(art.get('categories', [])),
        'tags': ','.join(art.get('tags', [])),
        'importance': art.get('importance', 'normal'),
        'text_length': len(art.get('text', '')),
    }

    if len(full) <= MAX_CHUNK:
        return [{'id': art['id'], 'text': full,
                 'metadata': {**meta, 'chunk_index': 0, 'total_chunks': 1}}]

    # Split long articles
    chunks = []
    max_len = MAX_CHUNK - len(header) - 30
    if max_len < 500:
        max_len = 500
    text = art.get('text', '')
    start = 0
    idx = 0
    overlap = 200

    while start < len(text):
        end = min(start + max_len, len(text))

        # Try to break at sentence boundary
        if end < len(text):
            bp = max(text.rfind('.', start, end), text.rfind('\n', start, end))
            if bp > start + max_len * 0.5:
                end = bp + 1

        chunks.append({
            'id': f"{art['id']}_chunk{idx}",
            'text': f"{header} [ч.{idx+1}]\n\n{text[start:end].strip()}",
            'metadata': {**meta, 'chunk_index': idx, 'total_chunks': 0}
        })
        idx += 1

        # FIXED: if we reached the end, stop
        if end >= len(text):
            break

        # Advance with overlap, but ALWAYS move forward
        new_start = end - overlap
        if new_start <= start:
            new_start = start + 1  # force progress
        start = new_start

    for c in chunks:
        c['metadata']['total_chunks'] = len(chunks)
    return chunks


def main():
    print('=' * 45)
    print('  AGENTIS LAW — Embeddings + Pinecone')
    print('=' * 45)
    print()

    if not OPENAI_KEY:
        print('❌ export OPENAI_API_KEY=sk-...'); sys.exit(1)
    if not PINECONE_KEY:
        print('❌ export PINECONE_API_KEY=pcsk_...'); sys.exit(1)

    # 1. Load & chunk
    print('📖 Loading articles...')
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        articles = json.load(f)
    print(f'   {len(articles)} articles')

    print('✂️  Chunking...')
    all_chunks = []
    for art in articles:
        all_chunks.extend(article_to_chunks(art))
    print(f'   {len(all_chunks)} chunks')
    del articles

    # 2. Pinecone
    print('\n📌 Pinecone...')
    host = ensure_pinecone_index()
    print(f'   {host}')

    # 3. Embed + upload
    total = len(all_chunks)
    total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    total_tokens = 0
    uploaded = 0

    print(f'\n🚀 {total} chunks in {total_batches} batches...\n')

    for i in range(0, total, BATCH_SIZE):
        batch = all_chunks[i:i+BATCH_SIZE]
        bnum = i // BATCH_SIZE + 1
        sys.stdout.write(f'  [{bnum}/{total_batches}] ')
        sys.stdout.flush()

        # Embed
        emb = None
        for r in range(3):
            try:
                emb = openai_embed([c['text'] for c in batch])
                break
            except Exception as e:
                sys.stdout.write(f'retry...')
                sys.stdout.flush()
                time.sleep(3 * (r + 1))
        if not emb:
            print('❌ skip'); continue

        total_tokens += emb.get('usage', {}).get('total_tokens', 0)

        vectors = [{'id': batch[j]['id'], 'values': emb['data'][j]['embedding'],
                     'metadata': batch[j]['metadata']} for j in range(len(batch))]

        # Upload
        for r in range(3):
            try:
                pinecone_api('POST', f'{host}/vectors/upsert',
                             {'vectors': vectors, 'namespace': NAMESPACE})
                break
            except Exception as e:
                sys.stdout.write('pine-retry...')
                sys.stdout.flush()
                time.sleep(3 * (r + 1))

        uploaded += len(vectors)
        cost = (total_tokens / 1_000_000) * 0.02
        print(f'✅ {uploaded}/{total} (${cost:.4f})')
        time.sleep(0.3)

    # 4. Stats
    time.sleep(3)
    try:
        stats = pinecone_api('POST', f'{host}/describe_index_stats', {})
        print()
        print('=' * 45)
        print('  ✅ DONE')
        print(f'  Uploaded: {uploaded}')
        print(f'  Pinecone vectors: {stats.get("totalVectorCount", "?")}')
        ns = stats.get('namespaces', {}).get(NAMESPACE, {})
        print(f'  Namespace "{NAMESPACE}": {json.dumps(ns)}')
        print(f'  Tokens: {total_tokens:,}')
        print(f'  Cost: ~${(total_tokens / 1_000_000) * 0.02:.4f}')
        print('=' * 45)
    except:
        print(f'\n✅ Uploaded {uploaded} vectors')


if __name__ == '__main__':
    main()
