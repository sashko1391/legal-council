/**
 * PDF Export Service
 * 
 * Generates a professional HTML report that can be:
 * 1. Returned as HTML for browser print-to-PDF
 * 2. Converted server-side with puppeteer (future)
 * 
 * Approach: Generate well-styled HTML with @media print CSS.
 * The frontend opens this HTML and triggers window.print() for PDF.
 * This avoids heavy server-side dependencies like puppeteer.
 */

import { logger } from '../utils/logger';

// ==========================================
// TYPES
// ==========================================

export interface ReviewReportData {
  type: 'review';
  summary: string;
  overallRiskScore: number;
  confidence: number;
  contractType?: string;
  risks: Array<{
    severity: number;
    title: string;
    description: string;
    legalCitation?: string;
    recommendation?: string;
    agent?: string;
  }>;
  criticalRisks: Array<{
    title: string;
    description: string;
    impact: string;
    mitigation: string;
  }>;
  recommendations: Array<{
    priority: string;
    action: string;
    rationale: string;
  }>;
  metadata: {
    analyzedAt: string;
    totalCost: number;
    processingTimeMs: number;
  };
}

export interface GenerationReportData {
  type: 'generation';
  documentText: string;
  documentType: string;
  qualityMetrics: {
    complianceScore: number;
    legalSoundness: number;
    clarity: number;
    overall: number;
  };
  summary: string;
  recommendations: string[];
  metadata: {
    generatedAt: string;
    confidence: number;
    totalCost: number;
    processingTimeMs: number;
  };
}

export type ReportData = ReviewReportData | GenerationReportData;

// ==========================================
// HTML GENERATORS
// ==========================================

function getSeverityLabel(severity: number): string {
  const labels: Record<number, string> = {
    1: 'Мінімальний',
    2: 'Низький',
    3: 'Середній',
    4: 'Високий',
    5: 'Критичний',
  };
  return labels[severity] || 'Невизначений';
}

function getSeverityColor(severity: number): string {
  if (severity >= 4) return '#dc2626';
  if (severity >= 3) return '#f59e0b';
  if (severity >= 2) return '#3b82f6';
  return '#22c55e';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/**
 * Generate HTML for a review report.
 */
function generateReviewHTML(data: ReviewReportData): string {
  const risksHtml = data.risks
    .sort((a, b) => b.severity - a.severity)
    .map((risk) => `
      <div class="risk-item" style="border-left: 4px solid ${getSeverityColor(risk.severity)};">
        <div class="risk-header">
          <span class="severity-badge" style="background: ${getSeverityColor(risk.severity)};">
            ${getSeverityLabel(risk.severity)}
          </span>
          <strong>${escapeHtml(risk.title)}</strong>
          ${risk.agent ? `<span class="agent-tag">${escapeHtml(risk.agent)}</span>` : ''}
        </div>
        <p>${escapeHtml(risk.description)}</p>
        ${risk.legalCitation ? `<p class="legal-ref">📜 ${escapeHtml(risk.legalCitation)}</p>` : ''}
        ${risk.recommendation ? `<p class="recommendation">💡 ${escapeHtml(risk.recommendation)}</p>` : ''}
      </div>
    `).join('');

  const recsHtml = data.recommendations
    .map((rec) => `
      <div class="rec-item">
        <span class="priority-badge priority-${rec.priority}">${rec.priority.toUpperCase()}</span>
        <strong>${escapeHtml(rec.action)}</strong>
        ${rec.rationale ? `<p class="rationale">${escapeHtml(rec.rationale)}</p>` : ''}
      </div>
    `).join('');

  return `
    <div class="report-section">
      <h2>📊 Загальна Оцінка</h2>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-value" style="color: ${data.overallRiskScore >= 7 ? '#dc2626' : data.overallRiskScore >= 4 ? '#f59e0b' : '#22c55e'}">
            ${data.overallRiskScore}/10
          </div>
          <div class="metric-label">Рівень ризику</div>
        </div>
        <div class="metric">
          <div class="metric-value">${Math.round(data.confidence * 100)}%</div>
          <div class="metric-label">Впевненість</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.risks.length}</div>
          <div class="metric-label">Проблем</div>
        </div>
        <div class="metric">
          <div class="metric-value">${(data.metadata.processingTimeMs / 1000).toFixed(0)}с</div>
          <div class="metric-label">Час аналізу</div>
        </div>
      </div>
    </div>

    <div class="report-section">
      <h2>📝 Резюме</h2>
      <p>${escapeHtml(data.summary)}</p>
    </div>

    <div class="report-section">
      <h2>⚠️ Виявлені Ризики (${data.risks.length})</h2>
      ${risksHtml}
    </div>

    <div class="report-section">
      <h2>💡 Рекомендації</h2>
      ${recsHtml}
    </div>
  `;
}

/**
 * Generate HTML for a generation report.
 */
function generateGenerationHTML(data: GenerationReportData): string {
  const recsHtml = data.recommendations
    .map((rec) => `<li>${escapeHtml(rec)}</li>`)
    .join('');

  return `
    <div class="report-section">
      <h2>📊 Метрики Якості</h2>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-value">${data.qualityMetrics.complianceScore}%</div>
          <div class="metric-label">Відповідність</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.qualityMetrics.legalSoundness}%</div>
          <div class="metric-label">Юр. якість</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.qualityMetrics.clarity}%</div>
          <div class="metric-label">Зрозумілість</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.qualityMetrics.overall}%</div>
          <div class="metric-label">Загалом</div>
        </div>
      </div>
    </div>

    <div class="report-section">
      <h2>📝 Короткий Зміст</h2>
      <p>${escapeHtml(data.summary)}</p>
    </div>

    <div class="report-section">
      <h2>📄 Текст Документа</h2>
      <div class="document-text">${escapeHtml(data.documentText)}</div>
    </div>

    ${data.recommendations.length > 0 ? `
    <div class="report-section">
      <h2>⚠️ Рекомендації Перед Підписанням</h2>
      <ul>${recsHtml}</ul>
    </div>
    ` : ''}
  `;
}

// ==========================================
// MAIN EXPORT
// ==========================================

/**
 * Generate a complete HTML report ready for print-to-PDF.
 */
export function generateReportHTML(data: ReportData): string {
  const date = new Date().toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const title = data.type === 'review'
    ? 'Звіт Аналізу Контракту'
    : `Згенерований Документ: ${(data as GenerationReportData).documentType}`;

  const bodyContent = data.type === 'review'
    ? generateReviewHTML(data as ReviewReportData)
    : generateGenerationHTML(data as GenerationReportData);

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AGENTIS — ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 30px;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #1a1a2e;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 28px; margin-bottom: 4px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .header .logo { font-size: 18px; font-weight: bold; color: #1a1a2e; letter-spacing: 2px; }

    .report-section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .report-section h2 {
      font-size: 18px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    .metric {
      text-align: center;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .metric-value { font-size: 28px; font-weight: bold; }
    .metric-label { font-size: 12px; color: #666; margin-top: 4px; }

    .risk-item {
      padding: 12px 16px;
      margin: 8px 0;
      background: #fafafa;
      border-radius: 6px;
    }
    .risk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .severity-badge {
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
    }
    .agent-tag {
      font-size: 11px;
      color: #888;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .legal-ref { font-size: 13px; color: #4a5568; margin-top: 4px; }
    .recommendation { font-size: 13px; color: #2563eb; margin-top: 4px; }

    .rec-item {
      padding: 8px 12px;
      margin: 6px 0;
      background: #f8fafc;
      border-radius: 4px;
    }
    .priority-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      margin-right: 6px;
    }
    .priority-high { background: #fecaca; color: #991b1b; }
    .priority-medium { background: #fed7aa; color: #9a3412; }
    .priority-low { background: #bbf7d0; color: #166534; }
    .rationale { font-size: 13px; color: #666; margin-top: 4px; }

    .document-text {
      font-family: 'Georgia', 'Times New Roman', serif;
      white-space: pre-wrap;
      background: #fafafa;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.8;
    }

    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #888;
    }

    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
      .report-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🛡️ AGENTIS</div>
    <h1>${title}</h1>
    <div class="subtitle">${date} • AI Legal Analysis Platform</div>
  </div>

  ${bodyContent}

  <div class="footer">
    <p>🛡️ AGENTIS — AI-система для аналізу та генерації юридичних документів</p>
    <p>Створено: ${date} • claude.ai + gpt-4o + gemini</p>
    <p style="margin-top: 8px; font-style: italic;">
      Цей звіт згенеровано автоматично. Рекомендуємо додаткову перевірку кваліфікованим юристом.
    </p>
  </div>

  <script class="no-print">
    // Auto-trigger print dialog if opened in new tab
    if (window.opener || window.location.search.includes('print=1')) {
      window.onload = () => window.print();
    }
  </script>
</body>
</html>`;
}
