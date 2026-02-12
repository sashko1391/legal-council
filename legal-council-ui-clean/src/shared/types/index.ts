// ============================================
// Risk Analysis Types
// ============================================

export type RiskSeverity = 1 | 2 | 3 | 4 | 5

export interface Risk {
  id: string
  title: string
  description: string
  severity: RiskSeverity
  confidence: number // 0-1
  legalBasis: string // "ЦКУ ст. 638"
  clauseReference: string // "Розділ 2, п. 2.1"
  excerpt: string // Quoted text from contract
  recommendation: string
}

export interface AnalysisResult {
  id: string
  contractId: string
  contractTitle: string
  overallRiskScore: number // 0-10
  confidence: number // 0-1
  risks: Risk[]
  recommendations: string[]
  agentOutputs: {
    expert: string
    provocateur: string
    validator: string
    synthesizer: string
  }
  createdAt: string
  updatedAt: string
}

// ============================================
// Agent Status Types
// ============================================

export type AgentName = 'expert' | 'provocateur' | 'validator' | 'synthesizer'

export type AgentStatus = 'pending' | 'running' | 'completed' | 'error'

export interface AgentProgress {
  name: AgentName
  status: AgentStatus
  progress: number // 0-100
  message?: string
  completedAt?: string
}

// ============================================
// Contract Types
// ============================================

export type ContractType = 
  | 'оренда'        // Lease
  | 'поставка'      // Supply
  | 'послуги'       // Services
  | 'трудовий'      // Employment
  | 'підряд'        // Contract work
  | 'купівля-продаж' // Purchase-sale
  | 'інше'          // Other

export interface Contract {
  id: string
  title: string
  type: ContractType
  content: string
  fileUrl?: string
  uploadedAt: string
  analyzedAt?: string
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'error'
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  createdAt: string
}

// ============================================
// UI State Types
// ============================================

export interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  activeModule: 'review' | 'generation' | 'analytics' | 'history'
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
