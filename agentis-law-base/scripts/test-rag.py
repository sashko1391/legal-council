#!/usr/bin/env python3
"""
Test RAG: search Pinecone for relevant articles given sample contract text.

Run:
  export OPENAI_API_KEY=sk-...
  export PINECONE_API_KEY=pcsk_...
  python3 scripts/test-rag.py
"""

import json, os, sys, urllib.request, urllib.error

OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '')
PINECONE_KEY = os.environ.get('PINECONE_API_KEY', '')
PINECONE_HOST = os.environ.get('PINECONE_HOST', '')  # will auto-detect
NAMESPACE = 'ua-law-v1'


def http_json(method, url, body=None, headers=None):
    hdrs = {'Content-Type': 'application/json'}
    if headers: hdrs.update(headers)
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))


def get_host():
    if PINECONE_HOST: return PINECONE_HOST
    indexes = http_json('GET', 'https://api.pinecone.io/indexes', headers={'Api-Key': PINECONE_KEY})
    idx = next((i for i in (indexes.get('indexes') or []) if i['name'] == 'agentis-law'), None)
    if not idx: raise Exception('Index not found')
    return f"https://{idx['host']}"


def embed(text):
    res = http_json('POST', 'https://api.openai.com/v1/embeddings',
        body={'model': 'text-embedding-3-small', 'input': text},
        headers={'Authorization': f'Bearer {OPENAI_KEY}'})
    return res['data'][0]['embedding']


def search(host, vector, top_k=10):
    res = http_json('POST', f'{host}/query',
        body={'vector': vector, 'topK': top_k, 'includeMetadata': True, 'namespace': NAMESPACE},
        headers={'Api-Key': PINECONE_KEY})
    return res.get('matches', [])


# ═══════════════════════════════════════════
#  TEST CASES
# ═══════════════════════════════════════════

TESTS = [
    {
        'name': '🏠 Договір оренди квартири',
        'text': '''Договір оренди житлового приміщення. 
        Орендодавець передає, а Орендар приймає у тимчасове платне користування квартиру. 
        Орендна плата складає 15000 грн на місяць. Строк оренди 12 місяців.
        Орендар зобов\'язаний своєчасно сплачувати орендну плату та комунальні послуги.''',
        'expect': ['lease', 'оренд', 'найм'],
    },
    {
        'name': '👷 Трудовий договір',
        'text': '''Трудовий договір. Роботодавець приймає Працівника на посаду менеджера з продажу.
        Випробувальний строк 3 місяці. Заробітна плата 25000 грн.
        Режим роботи: понеділок-п\'ятниця, з 9:00 до 18:00.
        Працівник має право на щорічну відпустку 24 календарних дні.''',
        'expect': ['employment', 'трудов', 'КЗпП'],
    },
    {
        'name': '🛒 Договір купівлі-продажу',
        'text': '''Договір купівлі-продажу товару. Продавець зобов\'язується передати у власність 
        Покупця товар, а Покупець зобов\'язується прийняти товар та оплатити його вартість.
        Ціна товару 500000 грн. Доставка за рахунок Продавця.
        Гарантійний строк 12 місяців з дати поставки.''',
        'expect': ['sale', 'купівл', 'продаж'],
    },
]


def main():
    print('=' * 50)
    print('  AGENTIS RAG — Test Search')
    print('=' * 50)

    host = get_host()
    print(f'Pinecone: {host}\n')

    for test in TESTS:
        print(f'\n{test["name"]}')
        print('-' * 50)

        # Embed query
        vector = embed(test['text'])

        # Search
        matches = search(host, vector, top_k=10)

        if not matches:
            print('  ❌ No results!')
            continue

        print(f'  Top 10 results (score = cosine similarity):\n')
        for m in matches:
            meta = m.get('metadata', {})
            score = m.get('score', 0)
            code = meta.get('code', '?')
            art_num = meta.get('article_number', '?')
            title = meta.get('title', '')[:60]
            importance = meta.get('importance', '')
            categories = meta.get('categories', '')

            icon = '🔴' if importance == 'critical' else '🟡' if importance == 'high' else '⚪'
            print(f'  {icon} {score:.3f}  {code} ст.{art_num} — {title}')
            print(f'          [{categories}]')

        # Check expectations
        all_text = ' '.join(
            f"{m.get('metadata',{}).get('code','')} {m.get('metadata',{}).get('title','')} {m.get('metadata',{}).get('categories','')}"
            for m in matches[:5]
        ).lower()
        
        found = [e for e in test['expect'] if e.lower() in all_text]
        if found:
            print(f'\n  ✅ Знайдено очікуване: {found}')
        else:
            print(f'\n  ⚠️  Очікувалось: {test["expect"]}')


if __name__ == '__main__':
    main()
