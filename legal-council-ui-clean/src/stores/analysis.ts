import { create } from 'zustand'
import type { AgentName, AgentStatus, AnalysisResult } from '@/shared/types'

interface AgentState {
  name: AgentName
  status: AgentStatus
  progress: number
  message?: string
  completedAt?: string
}

interface AnalysisState {
  // Current analysis
  currentAnalysis: AnalysisResult | null
  isAnalyzing: boolean
  
  // Agent progress
  agents: Record<AgentName, AgentState>
  
  // Overall progress
  overallProgress: number
  
  // Actions
  setCurrentAnalysis: (analysis: AnalysisResult | null) => void
  startAnalysis: () => void
  updateAgentStatus: (
    agent: AgentName,
    status: AgentStatus,
    message?: string
  ) => void
  updateAgentProgress: (agent: AgentName, progress: number) => void
  completeAgent: (agent: AgentName, message?: string) => void
  completeAnalysis: (result: AnalysisResult) => void
  resetAnalysis: () => void
}

const initialAgents: Record<AgentName, AgentState> = {
  expert: {
    name: 'expert',
    status: 'pending',
    progress: 0,
  },
  provocateur: {
    name: 'provocateur',
    status: 'pending',
    progress: 0,
  },
  validator: {
    name: 'validator',
    status: 'pending',
    progress: 0,
  },
  synthesizer: {
    name: 'synthesizer',
    status: 'pending',
    progress: 0,
  },
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  currentAnalysis: null,
  isAnalyzing: false,
  agents: initialAgents,
  overallProgress: 0,

  setCurrentAnalysis: (analysis) => 
    set({ currentAnalysis: analysis }),

  startAnalysis: () =>
    set({
      isAnalyzing: true,
      agents: {
        expert: { ...initialAgents.expert, status: 'running' },
        provocateur: initialAgents.provocateur,
        validator: initialAgents.validator,
        synthesizer: initialAgents.synthesizer,
      },
      overallProgress: 0,
    }),

  updateAgentStatus: (agent, status, message) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agent]: {
          ...state.agents[agent],
          status,
          message,
        },
      },
    })),

  updateAgentProgress: (agent, progress) =>
    set((state) => {
      const newAgents = {
        ...state.agents,
        [agent]: {
          ...state.agents[agent],
          progress,
        },
      }

      // Calculate overall progress
      const totalProgress = Object.values(newAgents).reduce(
        (sum, a) => sum + a.progress,
        0
      )
      const overallProgress = totalProgress / 4

      return {
        agents: newAgents,
        overallProgress,
      }
    }),

  completeAgent: (agent, message) =>
    set((state) => {
      const newAgents = {
        ...state.agents,
        [agent]: {
          ...state.agents[agent],
          status: 'completed' as AgentStatus,
          progress: 100,
          message,
          completedAt: new Date().toISOString(),
        },
      }

      // Start next agent
      const agentOrder: AgentName[] = ['expert', 'provocateur', 'validator', 'synthesizer']
      const currentIndex = agentOrder.indexOf(agent)
      const nextAgent = agentOrder[currentIndex + 1]

      if (nextAgent) {
        newAgents[nextAgent] = {
          ...newAgents[nextAgent],
          status: 'running',
        }
      }

      return { agents: newAgents }
    }),

  completeAnalysis: (result) =>
    set({
      currentAnalysis: result,
      isAnalyzing: false,
      overallProgress: 100,
    }),

  resetAnalysis: () =>
    set({
      currentAnalysis: null,
      isAnalyzing: false,
      agents: initialAgents,
      overallProgress: 0,
    }),
}))
