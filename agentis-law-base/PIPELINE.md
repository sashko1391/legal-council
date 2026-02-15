# AGENTIS Law Database — Pipeline

## Структура файлів

```
agentis-law-base/
├── scripts/
│   ├── laws-registry.js          ← Реєстр усіх законів (ЄДИНЕ МІСЦЕ для додавання)
│   ├── parse-universal.js        ← Парсер (замінює parse-cku.js + parse-kzpp.js)
│   ├── 03-categorize.js          ← Категоризація статей
│   └── 04-embed-and-upload.py    ← Embeddings → Pinecone
│
├── data/
│   ├── raw/                      ← .txt файли з zakon.rada.gov.ua
│   │   ├── cku.txt                  Цивільний кодекс
│   │   ├── kzpp.txt                 Кодекс законів про працю
│   │   ├── cpk.txt                  Цивільний процесуальний кодекс
│   │   ├── gpk.txt                  Господарський процесуальний кодекс
│   │   ├── kpk.txt                  Кримінальний процесуальний кодекс
│   │   ├── zu-zpp.txt               ЗУ "Про захист прав споживачів"
│   │   └── ...
│   │
│   ├── parsed/                   ← Проміжний результат парсера
│   │   ├── цку-parsed.json
│   │   ├── кзпп-parsed.json
│   │   └── ...
│   │
│   └── categorized/              ← Фінальний JSON для embeddings
│       ├── all-articles-categorized.json
│       └── articles-index.json
│
└── PIPELINE.md                   ← (цей файл)
```

## Що зберігати в Git, а що ні

| Директорія | В Git? | Причина |
|---|---|---|
| `scripts/` | ✅ Так | Це код пайплайну |
| `data/raw/` | ❌ Ні | Великі файли (ЦКУ ~2MB, ПКУ ~15MB). Зберігай окремо |
| `data/parsed/` | ❌ Ні | Регенерується з `raw/` за секунди |
| `data/categorized/` | ❌ Ні | Регенерується з `parsed/` |

### .gitignore
```
data/raw/
data/parsed/
data/categorized/
```

### Де тримати raw файли?

Варіанти:
1. **Локально** — папка на диску, бекапиться вручну
2. **Google Drive** — зберіг всі .txt в одну папку "AGENTIS Laws"
3. **Git LFS** — якщо хочеш версіонування (overkill для законів)

**Рекомендація:** Google Drive. Закони змінюються рідко, перезавантажуєш тільки при змінах.

## Production

У production потрібен **тільки Pinecone**. Жодних .txt, .json, parsed файлів.

```
Production runtime:
  App → law-rag-service.ts → Pinecone API → вектори вже там
```

Весь пайплайн `raw → parsed → categorized → embedded → Pinecone` — це **build-time** процес, як компіляція. Запускається один раз при додаванні нових законів.

## Як додати новий закон

### Крок 1: Скачати текст

1. Відкрий https://zakon.rada.gov.ua/laws/show/{document_id}#Text
2. Ctrl+A → Ctrl+C весь текст
3. Зберіг як `data/raw/<filename>.txt` (UTF-8)

**Важливо:** Копіюй ТІЛЬКИ текст закону, без:
- Шапки сайту
- Навігації
- "Документ є чинним" тощо
- Починай з першого "Розділ" або "Стаття"

### Крок 2: Додати в реєстр

Відкрий `scripts/laws-registry.js`, додай запис:

```js
{
  filename: 'zu-my-new-law.txt',
  code: 'ЗНЗ',           // Унікальне скорочення (2-4 літери)
  fullName: 'Закон України "Про щось важливе"',
  documentId: '1234-VIII',
  sourceUrl: 'https://zakon.rada.gov.ua/laws/show/1234-19',
  defaultCategories: ['general_contract'],  // Які типи договорів стосуються
  defaultTags: ['ключове слово 1', 'ключове слово 2'],
  importance: 'high',     // critical / high / normal
  enabled: true,
},
```

### Крок 3: Запустити пайплайн

```bash
# 1. Парсинг (конкретного або всіх)
node scripts/parse-universal.js zu-my-new-law.txt
node scripts/parse-universal.js            # або всіх

# 2. Категоризація
node scripts/03-categorize.js

# 3. Embeddings + завантаження в Pinecone
export OPENAI_API_KEY=sk-...
export PINECONE_API_KEY=pcsk_...
python3 scripts/04-embed-and-upload.py
```

### Крок 4: Перевірити

```bash
# Перевірити що закони в реєстрі
node scripts/parse-universal.js --list

# Тест RAG пошуку
python3 scripts/test-rag.py "оренда нерухомого майна"
```

## Вартість embeddings

| Модель | Ціна | ~1000 статей |
|---|---|---|
| text-embedding-3-small | $0.02/1M tokens | ~$0.04 |
| text-embedding-3-large | $0.13/1M tokens | ~$0.26 |

Ми використовуємо `text-embedding-3-small`. Весь ЦКУ (1300+ статей) коштує ~$0.05.
Додавання 10 нових законів (~3000 статей) ≈ $0.15.

## Категорії для RAG фільтрації

Доступні категорії (використовуються в `categories` полі):

| Категорія | Опис | Приклад закону |
|---|---|---|
| `general_contract` | Загальні положення про договори | ЦКУ Книга 5 |
| `sale` | Купівля-продаж | ЦКУ Гл.54, ЗПС |
| `lease` | Оренда / Найм | ЦКУ Гл.58-59, ЗОД, ЗОЗ |
| `service` | Послуги | ЦКУ Гл.63, ЗПС |
| `work` | Підряд | ЦКУ Гл.61 |
| `loan` | Позика / Кредит | ЦКУ Гл.71, ЗІП |
| `employment` | Трудові відносини | КЗпП |
| `insurance` | Страхування | ЦКУ Гл.67, ЗСТ |
| `commercial` | Господарська діяльність | ЗТВ |
| `consumer` | Захист споживачів | ЗПС, ЗЕК |
| `tax` | Податки | ПКУ |
| `property` | Право власності | ЦКУ Книга 3, ЗІП |
| `family` | Сімейне право | СКУ |
| `liability` | Відповідальність | ЦКУ Гл.51, ЗВП |
| `procedural` | Процесуальне право (загальне) | ЦПК, ГПК, КПК, КАСУ |
| `civil_procedure` | Цивільний процес | ЦПК |
| `commercial_procedure` | Господарський процес | ГПК |
| `criminal_procedure` | Кримінальний процес | КПК |
| `admin_procedure` | Адміністративний процес | КАСУ |

## Формат тексту з zakon.rada.gov.ua

Парсер автоматично розпізнає:

```
КНИГА ПЕРША                        ← book
ЗАГАЛЬНІ ПОЛОЖЕННЯ

Розділ I                            ← section
ОСНОВНІ ПОЛОЖЕННЯ

Глава 1                             ← chapter
ЦИВІЛЬНЕ ЗАКОНОДАВСТВО УКРАЇНИ

§ 2. Роздрібна купівля-продаж       ← paragraph

Стаття 1. Відносини, що регулюються  ← article (номер + назва)
1. Цивільним законодавством...       ← article text
2. До майнових відносин...           ← article text continues
```

Не всі рівні присутні в кожному законі. Наприклад, КЗпП не має Книг, а прості ЗУ часто мають тільки Розділи і Статті.
