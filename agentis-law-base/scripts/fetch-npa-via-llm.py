#!/usr/bin/env python3
"""
AGENTIS — Завантаження НПА через Claude API + web search

Бере список НПА з sublaws-registry.js, по одному питає Claude
знайти повний текст документа, зберігає як .txt

Запуск:
  pip install anthropic --break-system-packages
  export ANTHROPIC_API_KEY=sk-ant-...
  
  python3 scripts/fetch-npa-via-llm.py                  — всі НПА
  python3 scripts/fetch-npa-via-llm.py --dry             — тільки показати список
  python3 scripts/fetch-npa-via-llm.py --only ПНД        — тільки один по коду
  python3 scripts/fetch-npa-via-llm.py --skip-existing   — пропустити вже завантажені
"""

import os
import re
import sys
import json
import time
import argparse
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("❌ pip install anthropic --break-system-packages")
    sys.exit(1)

# ═══════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════

SCRIPT_DIR = Path(__file__).parent
RAW_DIR = SCRIPT_DIR / ".." / "data" / "raw"
REGISTRY_FILE = SCRIPT_DIR / "sublaws-registry.js"

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 16000
DELAY_BETWEEN = 5  # seconds between requests

# ═══════════════════════════════════════
#  PARSE sublaws-registry.js
# ═══════════════════════════════════════

def parse_registry(filepath: Path) -> list[dict]:
    """Parse JS registry file and extract НПА entries."""
    text = filepath.read_text(encoding="utf-8")
    
    entries = []
    # Match each { ... } block in the array
    blocks = re.findall(r'\{[^{}]+\}', text, re.DOTALL)
    
    for block in blocks:
        entry = {}
        # Extract fields
        for field in ['filename', 'code', 'shortName', 'fullName', 'sourceUrl', 'importance', 'type']:
            m = re.search(rf"{field}:\s*'([^']*)'", block)
            if m:
                entry[field] = m.group(1)
        
        # enabled: true/false
        m = re.search(r'enabled:\s*(true|false)', block)
        if m:
            entry['enabled'] = m.group(1) == 'true'
        
        if entry.get('filename') and entry.get('enabled'):
            entries.append(entry)
    
    return entries


# ═══════════════════════════════════════
#  LLM FETCH
# ═══════════════════════════════════════

PROMPT_TEMPLATE = """Знайди та поверни ПОВНИЙ ТЕКСТ цього українського нормативно-правового акту:

Назва: {fullName}
Офіційне джерело: {sourceUrl}

ІНСТРУКЦІЇ:
1. Знайди цей документ на zakon.rada.gov.ua або іншому офіційному джерелі
2. Поверни ПОВНИЙ ТЕКСТ документа — всі статті/пункти, від початку до кінця
3. Якщо документ дуже великий — поверни максимум тексту, починаючи з початку
4. НЕ додавай своїх коментарів, пояснень чи резюме — ТІЛЬКИ текст документа
5. Зберігай оригінальну структуру: нумерацію статей/пунктів, розділи, підрозділи
6. Текст повинен бути УКРАЇНСЬКОЮ мовою як в оригіналі

Поверни ТІЛЬКИ текст документа, без будь-яких вступних чи завершальних фраз."""


def fetch_via_llm(client: anthropic.Anthropic, entry: dict) -> str | None:
    """Ask Claude to find and return full text of an НПА."""
    
    prompt = PROMPT_TEMPLATE.format(
        fullName=entry.get('fullName', ''),
        sourceUrl=entry.get('sourceUrl', ''),
    )
    
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            tools=[{
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": 5,
            }],
            messages=[{"role": "user", "content": prompt}],
        )
        
        # Extract text from response
        text_parts = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
        
        full_text = "\n".join(text_parts).strip()
        
        # Basic quality check
        if len(full_text) < 500:
            print(f"   ⚠️ Замалий результат ({len(full_text)} chars)")
            return None
        
        # Remove common LLM preambles
        lines = full_text.split('\n')
        # Skip lines that look like Claude's commentary
        start_idx = 0
        for i, line in enumerate(lines[:5]):
            lower = line.lower().strip()
            if any(w in lower for w in ['ось повний текст', 'нижче наведено', 'ось текст', 'here is', 'знайшов текст']):
                start_idx = i + 1
                continue
            if lower.startswith('##') or lower.startswith('**'):
                # Could be markdown header Claude added
                if i < 3 and not any(c in lower for c in ['стаття', 'пункт', 'розділ', 'глава']):
                    start_idx = i + 1
                    continue
            break
        
        if start_idx > 0:
            full_text = '\n'.join(lines[start_idx:]).strip()
        
        # Token usage
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        print(f"   📊 tokens: in={input_tokens}, out={output_tokens}")
        
        return full_text
        
    except anthropic.APIError as e:
        print(f"   ❌ API error: {e}")
        return None
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None


# ═══════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Fetch НПА via Claude API')
    parser.add_argument('--dry', action='store_true', help='Dry run — show list only')
    parser.add_argument('--only', type=str, help='Fetch only this code (e.g. ПНД)')
    parser.add_argument('--skip-existing', action='store_true', help='Skip already downloaded')
    parser.add_argument('--force', action='store_true', help='Overwrite existing files')
    args = parser.parse_args()
    
    # Check API key
    if not args.dry and not os.environ.get('ANTHROPIC_API_KEY'):
        print("❌ export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)
    
    # Parse registry
    if not REGISTRY_FILE.exists():
        print(f"❌ {REGISTRY_FILE} не знайдено")
        sys.exit(1)
    
    entries = parse_registry(REGISTRY_FILE)
    
    print("═" * 60)
    print("  AGENTIS — Завантаження НПА через Claude API")
    print("═" * 60)
    print(f"\n  📋 В реєстрі: {len(entries)} НПА")
    print(f"  🤖 Модель:    {MODEL}")
    print(f"  📁 Вихід:     {RAW_DIR.resolve()}")
    
    # Filter
    if args.only:
        entries = [e for e in entries if e.get('code') == args.only]
        if not entries:
            print(f"\n❌ Код '{args.only}' не знайдено")
            sys.exit(1)
        print(f"  🔹 Тільки:    {args.only}")
    
    # Check existing
    to_download = []
    already_exists = []
    
    for entry in entries:
        filepath = RAW_DIR / entry['filename']
        if filepath.exists() and filepath.stat().st_size > 500:
            if args.skip_existing or (not args.force and not args.only):
                already_exists.append(entry)
                continue
        to_download.append(entry)
    
    if already_exists:
        print(f"  ⏭️  Вже є:     {len(already_exists)}")
    print(f"  📥 До завант.: {len(to_download)}")
    
    # Dry run
    if args.dry:
        print("\n  Список для завантаження:")
        for e in to_download:
            print(f"    {e['code']:10s} {e['fullName'][:55]}")
        print(f"\n  👀 Dry run. Зніміть --dry для завантаження.")
        return
    
    if not to_download:
        print("\n✅ Все вже завантажено!")
        return
    
    # Estimate cost
    est_cost = len(to_download) * 0.02  # ~$0.02 per request estimate
    print(f"\n  💰 Орієнтовна вартість: ~${est_cost:.2f}")
    print(f"  ⏱️  Орієнтовний час: ~{len(to_download) * 20}с")
    
    input(f"\n  Enter для старту ({len(to_download)} НПА)... ")
    
    # Init client
    client = anthropic.Anthropic()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    
    # Process
    success = 0
    failed = 0
    total_chars = 0
    
    for i, entry in enumerate(to_download):
        code = entry.get('code', '???')
        name = entry.get('fullName', '')[:55]
        
        print(f"\n[{i+1}/{len(to_download)}] {code} — {name}")
        print(f"   🌐 {entry.get('sourceUrl', 'no URL')}")
        
        text = fetch_via_llm(client, entry)
        
        if text and len(text) > 500:
            filepath = RAW_DIR / entry['filename']
            filepath.write_text(text, encoding='utf-8')
            size_kb = len(text) / 1024
            
            # Quick stats
            articles = len(re.findall(r'Стаття\s+\d+', text))
            punkty = len(re.findall(r'^\s*\d+\.', text, re.MULTILINE))
            struct = f"{articles} ст." if articles > 0 else f"{punkty} п."
            
            print(f"   ✅ {filepath.name} ({size_kb:.0f}KB, {struct})")
            success += 1
            total_chars += len(text)
        else:
            print(f"   ❌ Не вдалось отримати текст")
            failed += 1
        
        # Delay between requests
        if i < len(to_download) - 1:
            print(f"   ⏳ пауза {DELAY_BETWEEN}с...")
            time.sleep(DELAY_BETWEEN)
    
    # Summary
    print("\n" + "═" * 60)
    print("  РЕЗУЛЬТАТ")
    print("═" * 60)
    print(f"  ✅ Успішно:  {success}/{len(to_download)}")
    print(f"  ❌ Помилки:  {failed}")
    print(f"  💾 Текст:    {total_chars / 1024:.0f} KB")
    
    if success > 0:
        print("\n🚀 Далі:")
        print("   node scripts/parse-universal.js --sublaws-only")
        print("   node scripts/03-categorize.js")
        print("   node scripts/04-embed.js")
    print()


if __name__ == '__main__':
    main()
