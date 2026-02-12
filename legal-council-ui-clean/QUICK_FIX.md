# 🔧 Quick Fix - Config Files

## ❌ Проблема

```
Error: Configuring Next.js via 'next.config.ts' is not supported. 
Please replace the file with 'next.config.js' or 'next.config.mjs'.
```

**Причина:** Next.js 14.1 не підтримує TypeScript config файли (тільки з версії 15+)

---

## ✅ Рішення

### Варіант A: Використати Оновлений Архів

Завантаж **legal-council-ui-fixed.tar.gz** (вже виправлений):

```bash
tar -xzf legal-council-ui-fixed.tar.gz
cd legal-council-ui
npm install
npm run dev
```

---

### Варіант B: Виправити Вручну (якщо вже розпакував)

У твоєму проекті:

#### 1. Видали TypeScript конфіги

```bash
cd legal-council-ui
rm next.config.ts
rm tailwind.config.ts
```

#### 2. Створи `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  
  optimizeFonts: true,
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  env: {
    NEXT_PUBLIC_APP_NAME: 'Legal Council',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
}

module.exports = nextConfig
```

#### 3. Створи `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        
        risk: {
          critical: 'hsl(0 84% 60%)',
          high: 'hsl(25 95% 53%)',
          medium: 'hsl(48 96% 53%)',
          low: 'hsl(142 71% 45%)',
          safe: 'hsl(142 76% 36%)',
        },
        
        brand: {
          primary: 'hsl(221 83% 53%)',
          secondary: 'hsl(210 40% 96%)',
          dark: 'hsl(221 39% 11%)',
        },
      },
      
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        card: '0 2px 8px rgba(0, 0, 0, 0.08)',
        none: 'none',
      },
      
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

#### 4. Запусти

```bash
npm run dev
```

---

## ✅ Перевірка

Якщо все OK, ти побачиш:

```
 ✓ Ready in 2.5s
 ○ Local:        http://localhost:3000
 ○ Network:      http://192.168.x.x:3000
```

Відкрий браузер → http://localhost:3000 → побачиш Landing page! 🎉

---

## 🐛 Якщо Інші Помилки

### 1. "Module not found: Can't resolve '@/ui'"

**Проблема:** TypeScript не бачить path aliases  
**Рішення:** Перезапусти VS Code або TypeScript server

```bash
# У VS Code:
Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

### 2. "tailwindcss-animate" not found

**Проблема:** Залежність не встановлена  
**Рішення:**

```bash
npm install tailwindcss-animate
```

### 3. Fonts не завантажуються

**Проблема:** Next.js fonts optimization  
**Рішення:** Це нормально при першому запуску, fonts кешуються автоматично

---

## 📋 Checklist

- [ ] Видалено `next.config.ts`
- [ ] Видалено `tailwind.config.ts`
- [ ] Створено `next.config.js`
- [ ] Створено `tailwind.config.js`
- [ ] Запущено `npm run dev`
- [ ] Браузер відкрито на localhost:3000
- [ ] Landing page відображається
- [ ] Sidebar працює
- [ ] Review page відкривається

---

## 🎯 Що Далі?

Після успішного запуску:

1. ✅ Перевір всі сторінки (/, /review, /history)
2. ✅ Перевір sidebar collapse/expand
3. ✅ Спробуй ввести текст у review form
4. ✅ Натисни "Проаналізувати" (побачиш mock progress)

Потім продовжимо з **Session 2:**
- API Integration
- Results Visualization
- File Upload

---

**Status:** ✅ FIXED - Ready to Run!
