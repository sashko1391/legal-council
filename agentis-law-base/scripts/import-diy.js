#!/usr/bin/env node
/**
 * AGENTIS — Імпорт НПА з diy/ (v2, content-based matching)
 * 
 * Матчить файли з sublaws-registry.js по ТЕКСТУ ДОКУМЕНТА:
 *   шукає fullName реєстрового запису всередині файлу.
 * 
 * Запуск:
 *   node scripts/import-diy.js                — показати матчі (dry run)
 *   node scripts/import-diy.js --apply        — скопіювати файли
 *   node scripts/import-diy.js --apply --force — перезаписати існуючі
 */

const fs = require('fs');
const path = require('path');
const { SUBLAWS_REGISTRY } = require('./sublaws-registry');

const DIY_DIR = path.join(__dirname, '..', 'data', 'raw', 'diy');
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

// ═══════════════════════════════════════
//  CONTENT-BASED MATCHING
// ═══════════════════════════════════════

function norm(text) {
  return text
    .toLowerCase()
    .replace(/[«»"''ʼ`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(content, entry) {
  const contentNorm = norm(content.substring(0, 15000));
  const fullNorm = norm(entry.fullName);

  // 1: Full name found in content
  if (contentNorm.includes(fullNorm)) {
    return { score: 1000, method: 'fullName exact' };
  }

  // 2: First 50 chars of fullName
  const first50 = fullNorm.substring(0, 50);
  if (first50.length > 20 && contentNorm.includes(first50)) {
    return { score: 800, method: 'fullName first50' };
  }

  // 3: First 30 chars
  const first30 = fullNorm.substring(0, 30);
  if (first30.length > 15 && contentNorm.includes(first30)) {
    return { score: 600, method: 'fullName first30' };
  }

  // 4: Key words overlap
  const nameWords = fullNorm.split(' ').filter(w => w.length > 4);
  if (nameWords.length === 0) return { score: 0, method: 'none' };

  let found = 0;
  for (const w of nameWords) {
    if (contentNorm.includes(w)) found++;
  }
  const ratio = found / nameWords.length;

  if (ratio >= 0.8 && nameWords.length >= 3) {
    return { score: Math.round(400 * ratio), method: `words ${found}/${nameWords.length}` };
  }
  if (ratio >= 0.6 && nameWords.length >= 4) {
    return { score: Math.round(300 * ratio), method: `words ${found}/${nameWords.length}` };
  }

  return { score: Math.round(100 * ratio), method: `words ${found}/${nameWords.length}` };
}

// ═══════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const force = args.includes('--force');

  if (!fs.existsSync(DIY_DIR)) {
    console.error(`❌ Папка не існує: ${DIY_DIR}`);
    process.exit(1);
  }

  const diyFiles = fs.readdirSync(DIY_DIR)
    .filter(f => f.endsWith('.txt') || f.endsWith('.html'))
    .sort();

  if (diyFiles.length === 0) {
    console.error(`❌ Жодних файлів у ${DIY_DIR}`);
    process.exit(1);
  }

  const enabled = SUBLAWS_REGISTRY.filter(s => s.enabled);

  console.log('═'.repeat(65));
  console.log('  AGENTIS — Імпорт НПА з diy/ (content matching)');
  console.log('═'.repeat(65));
  console.log(`\n  📁 diy/:     ${diyFiles.length} файлів`);
  console.log(`  📋 Реєстр:   ${enabled.length} НПА`);
  console.log(`  Режим:       ${apply ? '✅ APPLY' : '👀 DRY RUN (--apply)'}`);
  console.log();

  const matched = [];
  const unmatched = [];
  const usedRegistry = new Set();

  for (const diyFile of diyFiles) {
    const diyPath = path.join(DIY_DIR, diyFile);
    const content = fs.readFileSync(diyPath, 'utf-8');
    const sizeKB = Math.round(content.length / 1024);
    const firstLine = content.split('\n').find(l => l.trim().length > 10)?.trim().substring(0, 80) || '(empty)';

    const scores = enabled
      .filter(e => !usedRegistry.has(e.filename))
      .map(entry => ({ entry, ...scoreMatch(content, entry) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scores[0];

    console.log(`📄 ${diyFile} (${sizeKB}KB)`);
    console.log(`   "${firstLine}"`);

    if (best && best.score >= 200) {
      const icon = best.score >= 800 ? '🟢' : best.score >= 400 ? '🟡' : '🔵';
      const exists = fs.existsSync(path.join(RAW_DIR, best.entry.filename));

      console.log(`   ${icon} → ${best.entry.filename} [${best.method}, score=${best.score}]`);
      console.log(`      ${best.entry.fullName.substring(0, 65)}`);
      if (exists && !force) console.log(`      ⚠️ Вже є в raw/`);

      if (scores[1] && scores[1].score >= best.score * 0.7) {
        console.log(`      (альт: ${scores[1].entry.filename} [${scores[1].method}, ${scores[1].score}])`);
      }

      matched.push({
        diyFile, diyPath,
        target: best.entry.filename,
        targetPath: path.join(RAW_DIR, best.entry.filename),
        score: best.score, exists,
      });
      usedRegistry.add(best.entry.filename);
    } else {
      console.log(`   ❓ Не зматчено${best ? ` (best: ${best.entry.filename}, score=${best.score})` : ''}`);
      unmatched.push({ diyFile, diyPath, sizeKB });
    }
    console.log();
  }

  // ── SUMMARY ──
  console.log('═'.repeat(65));
  console.log(`  ✅ Зматчено:    ${matched.length}/${diyFiles.length}`);
  console.log(`  ❓ Не зматчено: ${unmatched.length}`);

  const inRaw = enabled.filter(s =>
    fs.existsSync(path.join(RAW_DIR, s.filename)) &&
    fs.statSync(path.join(RAW_DIR, s.filename)).size > 500
  );
  const stillMissing = enabled.filter(s =>
    !usedRegistry.has(s.filename) &&
    !inRaw.some(r => r.filename === s.filename)
  );

  if (stillMissing.length > 0) {
    console.log(`\n  📋 Ще потрібно (${stillMissing.length}):`);
    for (const s of stillMissing) {
      console.log(`     ${s.code.padEnd(10)} ${s.fullName.substring(0, 55)}`);
    }
  }

  // ── APPLY ──
  if (apply && matched.length > 0) {
    console.log('\n📦 Копіюю...\n');
    let copied = 0, skipped = 0;

    for (const m of matched) {
      if (m.exists && !force) {
        console.log(`  ⏭️  ${m.target}`);
        skipped++;
        continue;
      }
      fs.copyFileSync(m.diyPath, m.targetPath);
      console.log(`  ✅ ${m.diyFile} → ${m.target}`);
      copied++;
    }

    console.log(`\n✅ Скопійовано: ${copied}, пропущено: ${skipped}`);
    if (copied > 0) {
      console.log('\n🚀 Далі:');
      console.log('   node scripts/parse-universal.js');
      console.log('   node scripts/03-categorize.js');
      console.log('   node scripts/04-embed.js');
    }
  } else if (!apply && matched.length > 0) {
    console.log('\n👀 Dry run. Для копіювання: node scripts/import-diy.js --apply');
  }

  console.log();
}

main();
