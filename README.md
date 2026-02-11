# Legal Council 🏛️

Multi-agent AI platform for Ukrainian legal work - Contract Review & Document Generation

---

## 🎯 Features

### Tab 1: Contract Review 📋
Upload contract → 4 AI agents analyze → Executive report with risks & recommendations

**Agents:**
- **Expert** (Claude Sonnet 4.5) - Comprehensive legal analysis
- **Provocateur** (Gemini Flash) - Adversarial red-team critic
- **Validator** (Claude Sonnet 4.5) - Completeness checker
- **Synthesizer** (GPT-4) - Executive summary

### Tab 2: Document Generation 📝
Describe requirements → 4 AI agents draft → ДСТУ-compliant Ukrainian contract

**Agents:**
- **Analyzer** (Claude Sonnet 4.5) - Requirements parser
- **Drafter** (GPT-4) - ДСТУ-compliant contract writer
- **Validator** (Claude Sonnet 4.5) - Legal compliance checker
- **Polisher** (Claude Sonnet 4.5) - Final quality polish

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- API keys for: Anthropic Claude, OpenAI GPT, Google Gemini

### Installation

```bash
# 1. Clone repository
git clone https://github.com/yourusername/legal-council.git
cd legal-council

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# 4. Run development server
npm run dev

# 5. Open browser
# http://localhost:3000
```

---

## 📁 Project Structure

```
legal-council/
├── app/
│   └── api/
│       ├── review/route.ts          # Contract review endpoint
│       └── generate/route.ts        # Document generation endpoint
├── packages/
│   ├── core/
│   │   └── orchestrator/types.ts    # Shared types
│   └── legal-council/
│       ├── agents/                  # 8 AI agents
│       ├── orchestrators/           # 2 orchestrators
│       ├── config/                  # Prompts & models
│       ├── services/                # Ukrainian law service
│       └── types/                   # TypeScript definitions
├── .env.example                     # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔑 Environment Variables

Required API keys in `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=AIzaXXX
LEGAL_COUNCIL_ENV=testing
```

**Environment modes:**
- `production` - Best quality, highest cost (Opus as Expert)
- `testing` - Good quality, 70% cheaper (Sonnet as Expert) ✅ **Recommended**
- `development` - Max savings (Gemini where possible)

---

## 💰 Cost Estimates (Testing Mode)

- **Contract Review:** ~$0.14 per query
- **Document Generation:** ~$0.18 per query
- **100 queries/day:** ~$500/month

---

## 🇺🇦 Ukrainian Law Compliance

### ДСТУ 4163-2020
All generated documents follow Ukrainian document standards:
- Mandatory sections (ПРЕДМЕТ ДОГОВОРУ, ВАРТІСТЬ, etc.)
- Date format: ДД.ММ.РРРР
- Currency: гривні (not USD)
- Terminology: Замовник/Виконавець

### Legal Database
Hardcoded common laws (MVP):
- ЦКУ (Цивільний кодекс)
- ГКУ (Господарський кодекс)
- КЗпП (Кодекс законів про працю)

---

## 📡 API Usage

### Contract Review
```bash
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{
    "contractText": "ДОГОВІР про надання послуг...",
    "contractType": "consulting",
    "jurisdiction": "Ukraine"
  }'
```

### Document Generation
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "documentType": "nda",
    "requirements": "NDA between Company A and freelancer...",
    "jurisdiction": "Ukraine"
  }'
```

---

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Unit tests (when implemented)
npm test

# Integration tests with real APIs
LEGAL_COUNCIL_ENV=testing npm run test:integration
```

---

## 📚 Documentation

- **PROJECT_CONTEXT.md** - High-level overview, architecture, decisions
- **DEVELOPMENT_LOG.md** - Detailed development history, all discussions

---

## 🛠️ Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## 🚢 Deployment

### Vercel (Recommended)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Set environment variables in Vercel dashboard
# ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY
# LEGAL_COUNCIL_ENV=production
```

### Other Platforms
- Railway
- Render
- AWS Lambda + API Gateway
- Google Cloud Run

---

## 🔐 Security

- **Never commit `.env`** to Git
- Rotate API keys regularly
- Use environment variables in production
- Implement rate limiting for public APIs
- Consider adding authentication for production

---

## 📈 Roadmap

### MVP (Current)
- ✅ Backend complete (18 files)
- ✅ API routes
- ⏭️ Basic UI

### Phase 2
- Multi-round iteration (stop criteria ready)
- Real-time law updates (zakon.rada.gov.ua scraping)
- User authentication
- Database for audit logs

### Phase 3
- RAG for case law
- Multi-language support (English, Polish)
- Mobile app (React Native)
- Enterprise features

---

## 🤝 Contributing

Contributions welcome! Please:
1. Read PROJECT_CONTEXT.md first
2. Follow TypeScript strict mode
3. Add tests for new features
4. Update documentation

---

## 📄 License

MIT License - See LICENSE file

---

## 🙏 Acknowledgments

- Architecture inspired by Trading Council
- Ukrainian law references from zakon.rada.gov.ua
- Powered by: Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google)

---

## 📞 Support

- Issues: GitHub Issues
- Email: your-email@example.com
- Documentation: See PROJECT_CONTEXT.md

---

**Built with ❤️ for Ukrainian lawyers**
