/**
 * Mock API Route: Contract Review
 * POST /api/review
 * 
 * Returns simulated analysis after 3 seconds
 * TODO: Replace with real AI orchestrator when backend is integrated
 */

import { NextRequest, NextResponse } from 'next/server'

// Route config
export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Simulate delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Mock risks generator
function generateMockRisks(contractText: string) {
  const risks = []
  
  // Check for common issues
  if (!contractText.toLowerCase().includes('ціна') && !contractText.toLowerCase().includes('вартість')) {
    risks.push({
      id: '1',
      severity: 5,
      title: 'Відсутність ціни товару/послуг',
      description: 'Договір не містить чітко визначеної ціни, що суперечить істотним умовам договору',
      contractExcerpt: contractText.substring(0, 100) + '...',
      legalCitation: 'ЦКУ ст. 638 - Істотні умови договору',
      recommendation: 'Додайте конкретну ціну або механізм її визначення',
      confidence: 98,
      agentName: 'Експерт',
    })
  }
  
  if (!contractText.toLowerCase().includes('строк') && !contractText.toLowerCase().includes('термін')) {
    risks.push({
      id: '2',
      severity: 4,
      title: 'Нечіткі строки виконання',
      description: 'Термін виконання зобов\'язань не конкретизований',
      contractExcerpt: 'Роботи мають бути виконані в найкоротші терміни...',
      legalCitation: 'ЦКУ ст. 251 - Строки',
      recommendation: 'Вкажіть конкретну дату або кількість днів',
      confidence: 92,
      agentName: 'Провокатор',
    })
  }
  
  if (!contractText.toLowerCase().includes('спор') && !contractText.toLowerCase().includes('арбітраж')) {
    risks.push({
      id: '3',
      severity: 3,
      title: 'Відсутність механізму врегулювання спорів',
      description: 'Договір не визначає порядок вирішення конфліктів',
      contractExcerpt: '',
      legalCitation: 'ГКУ ст. 221',
      recommendation: 'Додайте розділ про порядок вирішення спорів',
      confidence: 85,
      agentName: 'Валідатор',
    })
  }
  
  if (!contractText.toLowerCase().includes('штраф') && !contractText.toLowerCase().includes('відповідальність')) {
    risks.push({
      id: '4',
      severity: 3,
      title: 'Відсутність відповідальності сторін',
      description: 'Не визначено штрафні санкції за порушення умов',
      contractExcerpt: '',
      legalCitation: 'ЦКУ ст. 611 - Відповідальність за порушення',
      recommendation: 'Додайте розділ з штрафними санкціями',
      confidence: 88,
      agentName: 'Експерт',
    })
  }
  
  // Add at least one positive finding
  risks.push({
    id: '5',
    severity: 1,
    title: 'Структура документу відповідає стандартам',
    description: 'Загальна структура договору відповідає вимогам',
    contractExcerpt: '',
    legalCitation: 'ДСТУ 4163-2020',
    recommendation: 'Структура документу в порядку',
    confidence: 95,
    agentName: 'Валідатор',
  })
  
  return risks
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate
    if (!body.contractText || typeof body.contractText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid contractText field' },
        { status: 400 }
      )
    }
    
    console.log(`📋 Mock review: ${body.contractText.length} chars`)
    
    // Simulate AI processing time (3 seconds)
    await sleep(3000)
    
    // Generate mock risks
    const risks = generateMockRisks(body.contractText)
    
    // Calculate stats
    const criticalCount = risks.filter(r => r.severity === 5).length
    const highCount = risks.filter(r => r.severity === 4).length
    const avgConfidence = Math.round(
      risks.reduce((sum, r) => sum + r.confidence, 0) / risks.length
    )
    
    // Return mock response
    return NextResponse.json({
      success: true,
      data: {
        risks,
        summary: {
          totalRisks: risks.length,
          critical: criticalCount,
          high: highCount,
          medium: risks.filter(r => r.severity === 3).length,
          low: risks.filter(r => r.severity === 2).length,
          safe: risks.filter(r => r.severity === 1).length,
          averageConfidence: avgConfidence,
        },
        metadata: {
          contractLength: body.contractText.length,
          contractType: body.contractType || 'unknown',
          analysisDate: new Date().toISOString(),
          mode: 'MOCK',
        }
      },
      metadata: {
        processingTimeMs: 3000,
        timestamp: new Date().toISOString(),
      },
    })
    
  } catch (error) {
    console.error('❌ Mock API error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
