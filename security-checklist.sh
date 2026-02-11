#!/bin/bash
# Legal Council - Security Checklist
# Run this before every commit

echo "🔐 Running security checks..."

# 1. Check .gitignore exists
if [ ! -f .gitignore ]; then
  echo "❌ .gitignore not found!"
  exit 1
fi

# 2. Check .env is ignored
if git check-ignore .env > /dev/null 2>&1; then
  echo "✅ .env is properly ignored"
else
  echo "❌ .env is NOT ignored! Add to .gitignore"
  exit 1
fi

# 3. Check no .env in staged files
if git diff --cached --name-only | grep -q "^\.env$"; then
  echo "❌ .env is staged for commit!"
  echo "   Run: git reset .env"
  exit 1
else
  echo "✅ .env not staged"
fi

# 4. Check no secrets in staged files (if gitleaks installed)
if command -v gitleaks &> /dev/null; then
  echo "🔍 Scanning for secrets with gitleaks..."
  gitleaks protect --staged --verbose --config .gitleaks.toml
  if [ $? -ne 0 ]; then
    echo "❌ Secrets detected! Remove them before commit."
    exit 1
  fi
  echo "✅ No secrets detected"
else
  echo "⚠️  gitleaks not installed (recommended)"
  echo "   Install: brew install gitleaks"
fi

# 5. Check API keys not hardcoded
echo "🔍 Checking for hardcoded API keys in staged files..."
if git diff --cached | grep -iE "(sk-ant-api|sk-[a-zA-Z0-9]{48}|AIza[a-zA-Z0-9_-]{35})" | grep -v ".env.example"; then
  echo "❌ Possible API key found in code!"
  echo "   Use environment variables instead."
  exit 1
else
  echo "✅ No hardcoded keys found"
fi

# 6. Check .env.example is up to date
if [ -f .env ] && [ -f .env.example ]; then
  env_keys=$(grep -o '^[A-Z_]*=' .env | sort)
  example_keys=$(grep -o '^[A-Z_]*=' .env.example | sort)
  
  if [ "$env_keys" != "$example_keys" ]; then
    echo "⚠️  .env and .env.example keys don't match"
    echo "   Update .env.example with new variables"
  else
    echo "✅ .env.example is up to date"
  fi
fi

echo ""
echo "✅ All security checks passed!"
echo "🚀 Safe to commit"
