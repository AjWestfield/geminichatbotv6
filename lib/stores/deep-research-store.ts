import { create } from 'zustand';
import { AsyncJob, DeepResearchOptions } from '@/lib/perplexity-async-client';
import { WebViewSession, WebPageContext } from '@/lib/services/browser-automation';

export interface ResearchPhase {
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  findings: string[];
  sources: any[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface ResearchSession {
  id: string;
  query: string;
  mode: 'sync' | 'async' | 'interactive';
  depth: 'surface' | 'moderate' | 'deep';
  status: 'idle' | 'planning' | 'researching' | 'analyzing' | 'completed' | 'failed';
  phases: ResearchPhase[];
  currentPhase?: string;
  asyncJobs: Map<string, AsyncJob>;
  activeJobId?: string;
  webViewSessions: WebViewSession[];
  activeWebViewId?: string;
  currentWebPage?: WebPageContext;
  findings: string[];
  sources: any[];
  insights: string[];
  contradictions: string[];
  knowledgeGaps: string[];
  report?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

interface DeepResearchStore {
  // State
  sessions: Map<string, ResearchSession>;
  activeSessionId: string | null;
  
  // Actions
  createSession: (query: string, options: {
    mode?: 'sync' | 'async' | 'interactive';
    depth?: 'surface' | 'moderate' | 'deep';
    researchOptions?: DeepResearchOptions;
  }) => string;
  
  updateSession: (sessionId: string, updates: Partial<ResearchSession>) => void;
  
  setActiveSession: (sessionId: string | null) => void;
  
  addAsyncJob: (sessionId: string, job: AsyncJob) => void;
  
  updateAsyncJob: (sessionId: string, jobId: string, job: AsyncJob) => void;
  
  addWebViewSession: (sessionId: string, webViewSession: WebViewSession) => void;
  
  updateWebPage: (sessionId: string, webPage: WebPageContext) => void;
  
  addPhaseFindings: (sessionId: string, phaseName: string, findings: string[], sources: any[]) => void;
  
  completePhase: (sessionId: string, phaseName: string) => void;
  
  setReport: (sessionId: string, report: string) => void;
  
  completeSession: (sessionId: string) => void;
  
  failSession: (sessionId: string, error: string) => void;
  
  // Getters
  getActiveSession: () => ResearchSession | null;
  getSession: (sessionId: string) => ResearchSession | null;
  exportSession: (sessionId: string) => string;
  clearSessions: () => void;
}

export const useDeepResearchStore = create<DeepResearchStore>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  createSession: (query, options = {}) => {
    const sessionId = `research_${Date.now()}`;
    const session: ResearchSession = {
      id: sessionId,
      query,
      mode: options.mode || 'async',
      depth: options.depth || 'deep',
      status: 'idle',
      phases: [],
      asyncJobs: new Map(),
      webViewSessions: [],
      findings: [],
      sources: [],
      insights: [],
      contradictions: [],
      knowledgeGaps: [],
      startedAt: new Date()
    };

    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, session);
      return {
        sessions: newSessions,
        activeSessionId: sessionId
      };
    });

    return sessionId;
  },

  updateSession: (sessionId, updates) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, { ...session, ...updates });
      return { sessions: newSessions };
    });
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  addAsyncJob: (sessionId, job) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newJobs = new Map(session.asyncJobs);
      newJobs.set(job.jobId, job);

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        asyncJobs: newJobs,
        activeJobId: job.jobId
      });

      return { sessions: newSessions };
    });
  },

  updateAsyncJob: (sessionId, jobId, job) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newJobs = new Map(session.asyncJobs);
      newJobs.set(jobId, job);

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        asyncJobs: newJobs
      });

      return { sessions: newSessions };
    });
  },

  addWebViewSession: (sessionId, webViewSession) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        webViewSessions: [...session.webViewSessions, webViewSession],
        activeWebViewId: webViewSession.id
      });

      return { sessions: newSessions };
    });
  },

  updateWebPage: (sessionId, webPage) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        currentWebPage: webPage
      });

      return { sessions: newSessions };
    });
  },

  addPhaseFindings: (sessionId, phaseName, findings, sources) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const phaseIndex = session.phases.findIndex(p => p.name === phaseName);
      const newPhases = [...session.phases];

      if (phaseIndex >= 0) {
        newPhases[phaseIndex] = {
          ...newPhases[phaseIndex],
          findings: [...newPhases[phaseIndex].findings, ...findings],
          sources: [...newPhases[phaseIndex].sources, ...sources]
        };
      } else {
        newPhases.push({
          name: phaseName,
          status: 'active',
          findings,
          sources,
          startedAt: new Date()
        });
      }

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        phases: newPhases,
        currentPhase: phaseName,
        findings: [...session.findings, ...findings],
        sources: [...session.sources, ...sources]
      });

      return { sessions: newSessions };
    });
  },

  completePhase: (sessionId, phaseName) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newPhases = session.phases.map(phase =>
        phase.name === phaseName
          ? { ...phase, status: 'completed' as const, completedAt: new Date() }
          : phase
      );

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        phases: newPhases
      });

      return { sessions: newSessions };
    });
  },

  setReport: (sessionId, report) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        report
      });

      return { sessions: newSessions };
    });
  },

  completeSession: (sessionId) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        status: 'completed',
        completedAt: new Date()
      });

      return { sessions: newSessions };
    });
  },

  failSession: (sessionId, error) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, {
        ...session,
        status: 'failed',
        error,
        completedAt: new Date()
      });

      return { sessions: newSessions };
    });
  },

  getActiveSession: () => {
    const state = get();
    return state.activeSessionId ? state.sessions.get(state.activeSessionId) || null : null;
  },

  getSession: (sessionId) => {
    return get().sessions.get(sessionId) || null;
  },

  exportSession: (sessionId) => {
    const session = get().sessions.get(sessionId);
    if (!session || !session.report) {
      return '# No research data available';
    }

    return session.report;
  },

  clearSessions: () => {
    set({ sessions: new Map(), activeSessionId: null });
  }
}))