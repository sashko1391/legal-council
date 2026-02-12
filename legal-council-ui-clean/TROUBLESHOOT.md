# ⚡ Швидке Вирішення Проблем

## 🔴 Помилка: "Module not found: Can't resolve '@/lib/utils'"

### ✅ РІШЕННЯ (2 хвилини):

```bash
# 1. ВИДАЛИ СТАРИЙ ПРОЕКТ
cd ~  # або де твій проект
rm -rf legal-council-ui legal-council-ui-clean

# 2. РОЗПАКУЙ НОВИЙ АРХІВ
tar -xzf legal-council-ui-FINAL.tar.gz

# 3. УВІЙДИ В ПАПКУ
cd legal-council-ui-clean

# 4. ВСТАНОВИ
npm install

# 5. ЗАПУСТИ
npm run dev
```

**ВАЖЛИВО:** Папка має називатись `legal-council-ui-clean`, НЕ `legal-council-ui`!

---

## ✅ Перевірка Що Файли Правильні

### Тест 1: Перевір button.tsx
```bash
head -10 src/shared/ui/button.tsx
```

**Має показати на лінії 5:**
```typescript
import { cn } from '@/shared/lib'
```

**Якщо показує `'@/lib/utils'` - це СТАРИЙ файл!**

### Тест 2: Перевір index.ts існує
```bash
cat src/shared/lib/index.ts
```

**Має показати:**
```typescript
export * from './utils'
```

**Якщо файл не існує - це СТАРИЙ архів!**

---

## 🎯 Контрольний Список

### Перед `npm run dev`:
- [ ] Видалив стару папку `legal-council-ui`
- [ ] Розпакував `legal-council-ui-FINAL.tar.gz`
- [ ] Зайшов в `legal-council-ui-clean`
- [ ] Запустив `npm install`
- [ ] Node version >= 18 (`node -v`)

### Після `npm run dev`:
- [ ] Немає червоної помилки
- [ ] Terminal показує "Ready in X.Xs"
- [ ] Браузер відкрив http://localhost:3000
- [ ] Бачу "Legal Council" заголовок
- [ ] Sidebar зліва працює

---

## 🔧 Інші Помилки

### "Cannot find module 'X'"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Port 3000 is already in use"
```bash
# Опція 1: Убий процес
lsof -i :3000
kill -9 <PID>

# Опція 2: Використай інший порт
npm run dev -- -p 3001
```

### "npm command not found"
```bash
# Встанови Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 📸 Як Має Виглядати

### Terminal після `npm run dev`:
```
   ▲ Next.js 14.1.0
   - Local:        http://localhost:3000

 ✓ Ready in 3.2s
 ○ Compiling / ...
 ✓ Compiled in 1.2s
```

### Browser (localhost:3000):
- Великий заголовок "Legal Council"
- Підзаголовок про AI-аналіз
- 3 feature cards (🔍 🚀 🇺🇦)
- Дві кнопки: "Проаналізувати Контракт" та "Історія Аналізів"
- Sidebar зліва з іконками

---

## 💬 Все Одно Не Працює?

Дай мені:

1. **Який архів розпакував?**
   - `legal-council-ui.tar.gz` ❌ Старий!
   - `legal-council-ui-fixed.tar.gz` ❌ Старий!
   - `legal-council-ui-FINAL.tar.gz` ✅ Правильний!

2. **В якій папці?**
   ```bash
   pwd
   ```
   Має бути: `.../legal-council-ui-clean`

3. **Що показує button.tsx?**
   ```bash
   grep "import { cn }" src/shared/ui/button.tsx
   ```

4. **Node version?**
   ```bash
   node -v
   ```

5. **Скріншот помилки**

---

**Останнє Оновлення:** 12.02.2026, 05:16  
**Файл:** legal-council-ui-FINAL.tar.gz  
**Статус:** ✅ 100% Working (перевірено)
