import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if required dependencies are available
    const checks = {
      langchain: false,
      langgraph: false,
      langchainCore: false,
      langchainCommunity: false,
      langchainOpenAI: false,
      langchainAnthropic: false,
      langchainGoogleGenAI: false,
    }

    // Test imports
    try {
      await import('langchain')
      checks.langchain = true
    } catch (e) {
      console.error('langchain import failed:', e)
    }

    try {
      await import('@langchain/langgraph')
      checks.langgraph = true
    } catch (e) {
      console.error('@langchain/langgraph import failed:', e)
    }

    try {
      await import('@langchain/core')
      checks.langchainCore = true
    } catch (e) {
      console.error('@langchain/core import failed:', e)
    }

    try {
      await import('@langchain/community')
      checks.langchainCommunity = true
    } catch (e) {
      console.error('@langchain/community import failed:', e)
    }

    try {
      await import('@langchain/openai')
      checks.langchainOpenAI = true
    } catch (e) {
      console.error('@langchain/openai import failed:', e)
    }

    try {
      await import('@langchain/anthropic')
      checks.langchainAnthropic = true
    } catch (e) {
      console.error('@langchain/anthropic import failed:', e)
    }

    try {
      await import('@langchain/google-genai')
      checks.langchainGoogleGenAI = true
    } catch (e) {
      console.error('@langchain/google-genai import failed:', e)
    }

    // Test workflow engine
    let workflowEngineStatus = 'not tested'
    try {
      const { WorkflowEngine } = await import('@/lib/langgraph/workflow-engine')
      workflowEngineStatus = 'available'
    } catch (e) {
      workflowEngineStatus = `failed: ${e instanceof Error ? e.message : 'unknown error'}`
    }

    // Test orchestrator
    let orchestratorStatus = 'not tested'
    try {
      const { WorkflowOrchestrator } = await import('@/lib/langgraph/orchestrator')
      orchestratorStatus = 'available'
    } catch (e) {
      orchestratorStatus = `failed: ${e instanceof Error ? e.message : 'unknown error'}`
    }

    const allChecksPass = Object.values(checks).every(v => v === true)

    return NextResponse.json({
      status: allChecksPass ? 'healthy' : 'unhealthy',
      checks,
      workflowEngine: workflowEngineStatus,
      orchestrator: orchestratorStatus,
      timestamp: new Date().toISOString(),
    }, {
      status: allChecksPass ? 200 : 503
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, {
      status: 500
    })
  }
}