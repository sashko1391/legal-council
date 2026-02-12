# Legal Council UI

🇺🇦 AI-powered аналіз юридичних договорів для українського ринку

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📋 Features

- ✅ **Contract Review** - 4 AI-агенти аналізують контракт
- ✅ **Real-time Progress** - Live streaming статусу агентів
- ✅ **Ukrainian Law** - Відповідність ЦКУ, ГКУ, КЗпП
- ⏳ **Document Generation** - Coming soon
- ⏳ **Analytics Dashboard** - Coming soon

## 🏗️ Architecture

### Modular Structure
```
src/
├── app/              # Next.js App Router
│   ├── (app)/       # Main app (with sidebar)
│   │   ├── review/
│   │   └── history/
│   └── page.tsx     # Landing page
├── modules/         # Feature modules
│   ├── review/
│   └── generation/
├── shared/          # Shared code
│   ├── ui/         # shadcn/ui components
│   ├── components/ # Custom components
│   └── types/      # TypeScript types
└── stores/         # Zustand stores
```

### Tech Stack

- **Next.js 14** - App Router, Server Components
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component primitives
- **Zustand** - State management
- **React Query** - API caching (coming)

## 🎨 Design System

### Colors
- **Risk Severity**: Critical (red), High (orange), Medium (yellow), Low (green), Safe (dark green)
- **Brand**: Deep blue (#3b82f6)
- **Themes**: Light (default), Dark

### Typography
- **UI**: Inter (sans-serif)
- **Contracts**: JetBrains Mono (monospace)

## 📝 Scripts

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run type-check # TypeScript validation
```

## 🔗 API Integration

Backend API should be available at:
- Development: `http://localhost:3000/api`
- Production: TBD

### Endpoints
- `POST /api/review` - Analyze contract
- `GET /api/history` - Get analysis history
- `POST /api/generate` - Generate document (coming)

## 🌐 Environment Variables

Create `.env.local`:

```bash
# API Keys (if needed)
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key

# App Config
NEXT_PUBLIC_APP_NAME="Legal Council"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

## 📦 Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

### Docker
```bash
docker build -t legal-council-ui .
docker run -p 3000:3000 legal-council-ui
```

## 🤝 Contributing

This is a private project for the Ukrainian legal market.

## 📄 License

Proprietary - All rights reserved

## 🙏 Credits

Built with:
- Claude Opus 4.5 (Anthropic)
- GPT-4 (OpenAI)
- Gemini 2.5 (Google)
