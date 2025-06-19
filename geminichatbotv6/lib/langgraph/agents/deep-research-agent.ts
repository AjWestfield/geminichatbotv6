import { BaseAgent, AgentConfig } from "./base-agent";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskPlan, PlannedStep } from "../workflow-engine";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { PerplexityClient } from "@/lib/perplexity-client";

export interface ResearchPhase {
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  findings: string[];
  sources: SourceReference[];
  confidence: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SourceReference {
  title: string;
  url: string;
  credibilityScore: number;
  relevanceScore: number;
  date?: string;
  author?: string;
  type: 'academic' | 'news' | 'blog' | 'official' | 'social' | 'unknown';
}

export interface DeepResearchState {
  topic: string;
  researchQuestion: string;
  phases: ResearchPhase[];
  currentPhaseIndex: number;
  overallProgress: number;
  keyFindings: string[];
  contradictions: string[];
  knowledgeGaps: string[];
  researchOutline: ResearchOutline;
  sessionId: string;
  totalSources: number;
  highQualitySources: number;
}

export interface ResearchOutline {
  mainTopic: string;
  subtopics: ResearchSubtopic[];
  methodology: string;
  expectedDuration: number;
}

export interface ResearchSubtopic {
  id: string;
  title: string;
  questions: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'researching' | 'completed';
  findings?: string[];
}

export class DeepResearchAgent extends BaseAgent {
  private perplexityClient: PerplexityClient;
  private researchState: DeepResearchState | null = null;

  constructor(config?: Partial<AgentConfig>) {
    const deepResearchTools = [
      new DynamicStructuredTool({
        name: "deep_web_search",
        description: "Perform comprehensive web search with source filtering and credibility scoring",
        schema: z.object({
          query: z.string().describe("The search query"),
          searchMode: z.enum(['web', 'academic']).optional().describe("Search mode"),
          domainFilter: z.array(z.string()).optional().describe("Specific domains to search"),
          recencyFilter: z.enum(['day', 'week', 'month', 'year']).optional().describe("Time filter"),
          minCredibilityScore: z.number().min(0).max(1).optional().describe("Minimum source credibility"),
        }),
        func: async ({ query, searchMode, domainFilter, recencyFilter, minCredibilityScore }) => {
          return this.performDeepSearch(query, {
            searchMode,
            domainFilter,
            recencyFilter,
            minCredibilityScore
          });
        },
      }),
      new DynamicStructuredTool({
        name: "analyze_sources",
        description: "Analyze and synthesize information from multiple sources with fact-checking",
        schema: z.object({
          sources: z.array(z.object({
            content: z.string(),
            url: z.string(),
            title: z.string()
          })).describe("Sources to analyze"),
          focusArea: z.string().optional().describe("Specific aspect to focus on"),
          crossReference: z.boolean().optional().describe("Cross-reference facts across sources"),
        }),
        func: async ({ sources, focusArea, crossReference }) => {
          return this.analyzeSourcesWithFactChecking(sources, focusArea, crossReference);
        },
      }),
      new DynamicStructuredTool({
        name: "generate_research_outline",
        description: "Generate a comprehensive research outline with subtopics and methodology",
        schema: z.object({
          topic: z.string().describe("Main research topic"),
          depth: z.enum(['surface', 'moderate', 'deep']).describe("Research depth level"),
          timeConstraint: z.number().optional().describe("Time limit in minutes"),
        }),
        func: async ({ topic, depth, timeConstraint }) => {
          return this.generateResearchOutline(topic, depth, timeConstraint);
        },
      }),
      new DynamicStructuredTool({
        name: "verify_facts",
        description: "Verify facts by cross-referencing multiple authoritative sources",
        schema: z.object({
          claims: z.array(z.string()).describe("Claims to verify"),
          requireAcademicSources: z.boolean().optional().describe("Require academic sources"),
        }),
        func: async ({ claims, requireAcademicSources }) => {
          return this.verifyFacts(claims, requireAcademicSources);
        },
      }),
      new DynamicStructuredTool({
        name: "identify_knowledge_gaps",
        description: "Identify gaps, contradictions, and areas needing further research",
        schema: z.object({
          findings: z.array(z.string()).describe("Current research findings"),
          topic: z.string().describe("Research topic"),
        }),
        func: async ({ findings, topic }) => {
          return this.identifyKnowledgeGaps(findings, topic);
        },
      }),
    ];

    super({
      name: "deep-research-agent",
      description: "Conducts comprehensive, multi-phase research with source verification and synthesis",
      modelProvider: "gemini",
      modelName: "gemini-2.5-pro-latest",
      systemPrompt: `You are an advanced research agent specializing in deep, comprehensive analysis. Your approach:

1. **Research Planning**: Create detailed research outlines with clear subtopics and questions
2. **Source Quality**: Prioritize academic, official, and authoritative sources
3. **Fact Verification**: Cross-reference information across multiple sources
4. **Critical Analysis**: Identify contradictions, biases, and knowledge gaps
5. **Iterative Refinement**: Continuously refine understanding through multiple research phases
6. **Clear Synthesis**: Present findings in a structured, well-cited format

Research Phases:
- Phase 1: Initial Exploration - Understand the topic landscape
- Phase 2: Deep Dive - Investigate specific aspects in detail
- Phase 3: Cross-Validation - Verify findings across sources
- Phase 4: Synthesis - Integrate findings into coherent insights
- Phase 5: Critical Review - Identify limitations and future directions

Always maintain academic rigor while keeping explanations accessible.`,
      customTools: deepResearchTools,
      ...config,
    });

    this.perplexityClient = new PerplexityClient();
  }

  async execute(input: {
    task: string;
    context?: any;
    previousResults?: any[];
    researchDepth?: 'surface' | 'moderate' | 'deep';
  }): Promise<any> {
    const depth = input.researchDepth || 'deep';
    
    try {
      // Initialize research state if not exists
      if (!this.researchState) {
        this.researchState = await this.initializeResearchState(input.task, depth);
      }

      // Execute current phase
      const currentPhase = this.researchState.phases[this.researchState.currentPhaseIndex];
      
      if (!currentPhase) {
        return this.finalizeResearch();
      }

      // Update phase status
      currentPhase.status = 'in-progress';
      currentPhase.startedAt = new Date();

      // Execute phase-specific research
      const phaseResult = await this.executeResearchPhase(currentPhase, input.context);
      
      // Update phase with results
      currentPhase.findings = phaseResult.findings;
      currentPhase.sources = phaseResult.sources;
      currentPhase.confidence = phaseResult.confidence;
      currentPhase.status = 'completed';
      currentPhase.completedAt = new Date();

      // Update overall progress
      this.updateOverallProgress();

      // Move to next phase or finalize
      if (this.researchState.currentPhaseIndex < this.researchState.phases.length - 1) {
        this.researchState.currentPhaseIndex++;
        
        // Continue with next phase
        return {
          status: 'in-progress',
          currentPhase: this.researchState.phases[this.researchState.currentPhaseIndex].name,
          progress: this.researchState.overallProgress,
          intermediateFindings: this.researchState.keyFindings,
          nextAction: 'continue-research'
        };
      } else {
        return this.finalizeResearch();
      }
    } catch (error) {
      console.error("Deep research execution error:", error);
      throw error;
    }
  }

  async plan(objective: string, context?: any): Promise<TaskPlan> {
    const researchOutline = await this.generateResearchOutline(
      objective, 
      context?.depth || 'deep',
      context?.timeLimit
    );

    const steps: PlannedStep[] = [
      this.createStep(
        "outline",
        "Generate Research Outline",
        `Create comprehensive research plan for: ${objective}`
      ),
      this.createStep(
        "initial-exploration",
        "Initial Exploration",
        "Broad search to understand topic landscape",
        ["outline"]
      ),
      this.createStep(
        "deep-dive",
        "Deep Dive Research",
        "Investigate specific subtopics in detail",
        ["initial-exploration"]
      ),
      this.createStep(
        "cross-validation",
        "Cross-Validate Findings",
        "Verify facts across multiple sources",
        ["deep-dive"]
      ),
      this.createStep(
        "identify-gaps",
        "Identify Knowledge Gaps",
        "Find contradictions and areas needing clarification",
        ["cross-validation"]
      ),
      this.createStep(
        "synthesis",
        "Synthesize Findings",
        "Integrate all findings into coherent insights",
        ["identify-gaps"]
      ),
      this.createStep(
        "critical-review",
        "Critical Review",
        "Review findings for bias and limitations",
        ["synthesis"]
      ),
      this.createStep(
        "final-report",
        "Generate Final Report",
        "Create comprehensive research report with citations",
        ["critical-review"]
      ),
    ];

    const estimatedDuration = this.estimateResearchDuration(researchOutline);
    return this.createPlan(steps, estimatedDuration);
  }

  private async initializeResearchState(topic: string, depth: 'surface' | 'moderate' | 'deep'): Promise<DeepResearchState> {
    const outline = await this.generateResearchOutline(topic, depth);
    
    const phases: ResearchPhase[] = [
      {
        name: "Initial Exploration",
        description: "Understand the topic landscape and identify key areas",
        status: 'pending',
        findings: [],
        sources: [],
        confidence: 0
      },
      {
        name: "Deep Dive",
        description: "Investigate specific aspects in detail",
        status: 'pending',
        findings: [],
        sources: [],
        confidence: 0
      },
      {
        name: "Cross-Validation",
        description: "Verify findings across multiple sources",
        status: 'pending',
        findings: [],
        sources: [],
        confidence: 0
      },
      {
        name: "Synthesis",
        description: "Integrate findings into coherent insights",
        status: 'pending',
        findings: [],
        sources: [],
        confidence: 0
      },
      {
        name: "Critical Review",
        description: "Identify limitations and biases",
        status: 'pending',
        findings: [],
        sources: [],
        confidence: 0
      }
    ];

    return {
      topic,
      researchQuestion: this.formulateResearchQuestion(topic),
      phases,
      currentPhaseIndex: 0,
      overallProgress: 0,
      keyFindings: [],
      contradictions: [],
      knowledgeGaps: [],
      researchOutline: outline,
      sessionId: `research_${Date.now()}`,
      totalSources: 0,
      highQualitySources: 0
    };
  }

  private async executeResearchPhase(
    phase: ResearchPhase, 
    context?: any
  ): Promise<{
    findings: string[];
    sources: SourceReference[];
    confidence: number;
  }> {
    const phaseStrategies: Record<string, () => Promise<any>> = {
      "Initial Exploration": async () => this.performInitialExploration(),
      "Deep Dive": async () => this.performDeepDive(),
      "Cross-Validation": async () => this.performCrossValidation(),
      "Synthesis": async () => this.performSynthesis(),
      "Critical Review": async () => this.performCriticalReview()
    };

    const strategy = phaseStrategies[phase.name];
    if (!strategy) {
      throw new Error(`Unknown research phase: ${phase.name}`);
    }

    return await strategy();
  }

  private async performDeepSearch(
    query: string, 
    options: {
      searchMode?: 'web' | 'academic';
      domainFilter?: string[];
      recencyFilter?: string;
      minCredibilityScore?: number;
    }
  ): Promise<any> {
    try {
      const searchOptions: any = {
        search_mode: options.searchMode || 'web',
        return_images: false,
        return_related_questions: true
      };

      if (options.domainFilter) {
        searchOptions.search_domain_filter = options.domainFilter;
      }

      if (options.recencyFilter) {
        searchOptions.search_recency_filter = options.recencyFilter;
      }

      const response = await this.perplexityClient.search(
        [
          { 
            role: 'system', 
            content: 'You are a research assistant providing comprehensive, well-sourced information.' 
          },
          { 
            role: 'user', 
            content: query 
          }
        ],
        searchOptions
      );

      // Process and score sources
      const processedResults = this.processSearchResults(response, options.minCredibilityScore);
      
      // Update research state
      if (this.researchState) {
        this.researchState.totalSources += processedResults.sources.length;
        this.researchState.highQualitySources += processedResults.sources.filter(
          s => s.credibilityScore >= 0.7
        ).length;
      }

      return processedResults;
    } catch (error) {
      console.error("Deep search error:", error);
      throw error;
    }
  }

  private processSearchResults(response: any, minCredibilityScore?: number): any {
    const sources: SourceReference[] = [];
    
    if (response.search_results) {
      response.search_results.forEach((result: any) => {
        const credibilityScore = this.calculateCredibilityScore(result);
        const relevanceScore = this.calculateRelevanceScore(result, response.choices?.[0]?.message?.content);
        
        if (!minCredibilityScore || credibilityScore >= minCredibilityScore) {
          sources.push({
            title: result.title,
            url: result.url,
            credibilityScore,
            relevanceScore,
            date: result.date,
            type: this.classifySourceType(result.url)
          });
        }
      });
    }

    return {
      content: response.choices?.[0]?.message?.content || '',
      sources: sources.sort((a, b) => b.credibilityScore - a.credibilityScore),
      relatedQuestions: response.related_questions || []
    };
  }

  private calculateCredibilityScore(source: any): number {
    let score = 0.5; // Base score
    
    // Domain authority
    const trustedDomains = ['.edu', '.gov', '.org', 'nature.com', 'science.org', 'ieee.org'];
    if (trustedDomains.some(domain => source.url.includes(domain))) {
      score += 0.3;
    }
    
    // Recency (if date available)
    if (source.date) {
      const daysOld = (Date.now() - new Date(source.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld < 30) score += 0.1;
      else if (daysOld < 365) score += 0.05;
    }
    
    // Has author information
    if (source.author) score += 0.1;
    
    return Math.min(score, 1);
  }

  private calculateRelevanceScore(source: any, content: string): number {
    // Simple relevance scoring based on title/content overlap
    const titleWords = source.title.toLowerCase().split(' ');
    const contentWords = content.toLowerCase().split(' ');
    
    const overlap = titleWords.filter(word => 
      contentWords.includes(word) && word.length > 3
    ).length;
    
    return Math.min(overlap / titleWords.length, 1);
  }

  private classifySourceType(url: string): SourceReference['type'] {
    if (url.includes('.edu') || url.includes('scholar')) return 'academic';
    if (url.includes('.gov') || url.includes('.org')) return 'official';
    if (url.includes('twitter.com') || url.includes('facebook.com')) return 'social';
    if (url.includes('medium.com') || url.includes('blog')) return 'blog';
    if (url.includes('news') || url.includes('times.com') || url.includes('post.com')) return 'news';
    return 'unknown';
  }

  private async analyzeSourcesWithFactChecking(
    sources: any[],
    focusArea?: string,
    crossReference: boolean = true
  ): Promise<any> {
    const analysisPrompt = `Analyze the following sources comprehensively:
${sources.map((s, i) => `Source ${i + 1} (${s.title}): ${s.content}`).join('\n\n')}

${focusArea ? `Focus specifically on: ${focusArea}` : 'Provide comprehensive analysis'}
${crossReference ? 'Cross-reference facts and identify any contradictions.' : ''}

Please provide:
1. Key findings with source attribution
2. Areas of consensus across sources
3. Contradictions or disagreements
4. Confidence level in findings
5. Gaps in available information`;

    const response = await this.invokeModel([
      new SystemMessage("You are an expert research analyst."),
      new HumanMessage(analysisPrompt)
    ]);

    return this.parseAnalysisResponse(response.content);
  }

  private async generateResearchOutline(
    topic: string,
    depth: 'surface' | 'moderate' | 'deep',
    timeConstraint?: number
  ): Promise<ResearchOutline> {
    const depthGuidelines = {
      surface: "3-5 main points, basic coverage",
      moderate: "5-8 subtopics with moderate detail",
      deep: "8-12 subtopics with comprehensive coverage"
    };

    const prompt = `Generate a comprehensive research outline for: "${topic}"

Depth level: ${depth} (${depthGuidelines[depth]})
${timeConstraint ? `Time constraint: ${timeConstraint} minutes` : 'No time constraint'}

Create a structured outline with:
1. Main research question
2. Subtopics with specific questions
3. Methodology approach
4. Priority levels for each subtopic`;

    const response = await this.invokeModel([
      new SystemMessage("You are a research planning expert."),
      new HumanMessage(prompt)
    ]);

    return this.parseOutlineResponse(response.content, topic);
  }

  private async verifyFacts(
    claims: string[],
    requireAcademicSources: boolean = false
  ): Promise<any> {
    const verificationResults = [];

    for (const claim of claims) {
      const searchMode = requireAcademicSources ? 'academic' : 'web';
      const searchResult = await this.performDeepSearch(
        `verify fact: "${claim}"`,
        { searchMode, minCredibilityScore: 0.7 }
      );

      const verificationStatus = this.analyzeVerificationResult(claim, searchResult);
      verificationResults.push({
        claim,
        status: verificationStatus.status,
        confidence: verificationStatus.confidence,
        supportingSources: verificationStatus.sources,
        explanation: verificationStatus.explanation
      });
    }

    return verificationResults;
  }

  private async identifyKnowledgeGaps(
    findings: string[],
    topic: string
  ): Promise<any> {
    const prompt = `Based on the following research findings about "${topic}":

${findings.join('\n\n')}

Identify:
1. Knowledge gaps - what information is missing?
2. Contradictions - where do sources disagree?
3. Uncertainties - what claims lack strong support?
4. Future research directions - what should be investigated next?
5. Methodological limitations - what biases or limitations exist?`;

    const response = await this.invokeModel([
      new SystemMessage("You are a critical research analyst."),
      new HumanMessage(prompt)
    ]);

    return this.parseGapAnalysis(response.content);
  }

  // Helper methods for research phases
  private async performInitialExploration(): Promise<any> {
    if (!this.researchState) throw new Error("Research state not initialized");

    const results = await this.performDeepSearch(
      this.researchState.topic,
      { searchMode: 'web', recencyFilter: 'year' }
    );

    const findings = this.extractKeyPoints(results.content);
    const sources = results.sources;

    // Identify subtopics for deeper investigation
    const subtopics = await this.identifySubtopics(results);
    this.researchState.researchOutline.subtopics = subtopics;

    return { findings, sources, confidence: 0.6 };
  }

  private async performDeepDive(): Promise<any> {
    if (!this.researchState) throw new Error("Research state not initialized");

    const findings: string[] = [];
    const sources: SourceReference[] = [];

    // Research each subtopic
    for (const subtopic of this.researchState.researchOutline.subtopics) {
      if (subtopic.priority === 'high' || subtopic.priority === 'medium') {
        for (const question of subtopic.questions) {
          const result = await this.performDeepSearch(question, {
            searchMode: 'web',
            minCredibilityScore: 0.6
          });

          findings.push(...this.extractKeyPoints(result.content));
          sources.push(...result.sources);
          subtopic.findings = this.extractKeyPoints(result.content);
          subtopic.status = 'completed';
        }
      }
    }

    return { findings, sources, confidence: 0.75 };
  }

  private async performCrossValidation(): Promise<any> {
    if (!this.researchState) throw new Error("Research state not initialized");

    // Collect all findings from previous phases
    const allFindings = this.researchState.phases
      .filter(p => p.status === 'completed')
      .flatMap(p => p.findings);

    // Extract factual claims
    const claims = this.extractFactualClaims(allFindings);
    
    // Verify claims
    const verificationResults = await this.verifyFacts(claims.slice(0, 10)); // Limit to top 10 claims

    // Identify contradictions
    const contradictions = verificationResults
      .filter(v => v.status === 'contradicted')
      .map(v => v.explanation);

    this.researchState.contradictions = contradictions;

    return {
      findings: verificationResults.map(v => `${v.claim}: ${v.status} (${v.confidence}% confidence)`),
      sources: verificationResults.flatMap(v => v.supportingSources),
      confidence: 0.85
    };
  }

  private async performSynthesis(): Promise<any> {
    if (!this.researchState) throw new Error("Research state not initialized");

    // Gather all verified findings
    const allFindings = this.researchState.phases
      .filter(p => p.status === 'completed')
      .flatMap(p => p.findings);

    const allSources = this.researchState.phases
      .filter(p => p.status === 'completed')
      .flatMap(p => p.sources);

    // Synthesize findings
    const synthesis = await this.analyzeSourcesWithFactChecking(
      allSources.slice(0, 20).map(s => ({
        title: s.title,
        url: s.url,
        content: allFindings.join(' ')
      })),
      this.researchState.researchQuestion,
      true
    );

    this.researchState.keyFindings = synthesis.keyFindings || [];

    return {
      findings: this.researchState.keyFindings,
      sources: allSources.filter(s => s.credibilityScore >= 0.7),
      confidence: 0.9
    };
  }

  private async performCriticalReview(): Promise<any> {
    if (!this.researchState) throw new Error("Research state not initialized");

    // Identify knowledge gaps
    const gapAnalysis = await this.identifyKnowledgeGaps(
      this.researchState.keyFindings,
      this.researchState.topic
    );

    this.researchState.knowledgeGaps = gapAnalysis.gaps || [];

    // Critical evaluation
    const criticalReview = await this.performCriticalEvaluation();

    return {
      findings: [
        ...gapAnalysis.gaps.map(g => `Knowledge gap: ${g}`),
        ...gapAnalysis.limitations.map(l => `Limitation: ${l}`),
        ...criticalReview.biases.map(b => `Potential bias: ${b}`)
      ],
      sources: this.researchState.phases
        .filter(p => p.status === 'completed')
        .flatMap(p => p.sources)
        .filter(s => s.credibilityScore >= 0.8),
      confidence: 0.95
    };
  }

  private async performCriticalEvaluation(): Promise<any> {
    const prompt = `Critically evaluate the research conducted on "${this.researchState?.topic}":

Key findings:
${this.researchState?.keyFindings.join('\n')}

Identify:
1. Potential biases in sources or methodology
2. Limitations of the research approach
3. Alternative interpretations of findings
4. Strength of evidence for conclusions`;

    const response = await this.invokeModel([
      new SystemMessage("You are a critical research evaluator."),
      new HumanMessage(prompt)
    ]);

    return this.parseCriticalEvaluation(response.content);
  }

  private finalizeResearch(): any {
    if (!this.researchState) throw new Error("Research state not initialized");

    const completedPhases = this.researchState.phases.filter(p => p.status === 'completed');
    const allSources = completedPhases.flatMap(p => p.sources);
    const uniqueSources = this.deduplicateSources(allSources);

    return {
      status: 'completed',
      topic: this.researchState.topic,
      researchQuestion: this.researchState.researchQuestion,
      keyFindings: this.researchState.keyFindings,
      contradictions: this.researchState.contradictions,
      knowledgeGaps: this.researchState.knowledgeGaps,
      sources: {
        total: this.researchState.totalSources,
        highQuality: this.researchState.highQualitySources,
        topSources: uniqueSources
          .sort((a, b) => b.credibilityScore - a.credibilityScore)
          .slice(0, 10)
      },
      confidence: this.calculateOverallConfidence(),
      researchDuration: this.calculateResearchDuration(),
      timestamp: new Date().toISOString()
    };
  }

  // Utility methods
  private updateOverallProgress(): void {
    if (!this.researchState) return;

    const completedPhases = this.researchState.phases.filter(p => p.status === 'completed').length;
    this.researchState.overallProgress = (completedPhases / this.researchState.phases.length) * 100;
  }

  private formulateResearchQuestion(topic: string): string {
    // Simple heuristic - in production, this would be more sophisticated
    if (topic.includes('?')) return topic;
    return `What are the key aspects, current understanding, and open questions regarding ${topic}?`;
  }

  private estimateResearchDuration(outline: ResearchOutline): number {
    const baseTime = 60000; // 1 minute base
    const perSubtopic = 30000; // 30 seconds per subtopic
    const depthMultiplier = outline.subtopics.filter(s => s.priority === 'high').length * 1.5;
    
    return baseTime + (outline.subtopics.length * perSubtopic * depthMultiplier);
  }

  private extractKeyPoints(content: string): string[] {
    // Simple extraction - in production, use NLP
    return content
      .split(/[.!?]/)
      .filter(s => s.length > 50)
      .map(s => s.trim())
      .slice(0, 5);
  }

  private extractFactualClaims(findings: string[]): string[] {
    // Extract statements that appear to be factual claims
    return findings.filter(f => 
      !f.includes('may') && 
      !f.includes('might') && 
      !f.includes('could') &&
      (f.includes('is') || f.includes('are') || f.includes('was') || f.includes('were'))
    );
  }

  private async identifySubtopics(searchResults: any): Promise<ResearchSubtopic[]> {
    // Use related questions and content analysis to identify subtopics
    const subtopics: ResearchSubtopic[] = [];
    
    if (searchResults.relatedQuestions) {
      searchResults.relatedQuestions.forEach((question: string, index: number) => {
        subtopics.push({
          id: `subtopic_${index}`,
          title: question,
          questions: [question],
          priority: index < 3 ? 'high' : 'medium',
          status: 'pending'
        });
      });
    }

    return subtopics;
  }

  private deduplicateSources(sources: SourceReference[]): SourceReference[] {
    const seen = new Set<string>();
    return sources.filter(source => {
      if (seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    });
  }

  private calculateOverallConfidence(): number {
    if (!this.researchState) return 0;

    const phaseConfidences = this.researchState.phases
      .filter(p => p.status === 'completed')
      .map(p => p.confidence);

    if (phaseConfidences.length === 0) return 0;

    return phaseConfidences.reduce((a, b) => a + b, 0) / phaseConfidences.length;
  }

  private calculateResearchDuration(): number {
    if (!this.researchState) return 0;

    const firstPhase = this.researchState.phases.find(p => p.startedAt);
    const lastPhase = [...this.researchState.phases].reverse().find(p => p.completedAt);

    if (!firstPhase?.startedAt || !lastPhase?.completedAt) return 0;

    return lastPhase.completedAt.getTime() - firstPhase.startedAt.getTime();
  }

  private analyzeVerificationResult(claim: string, searchResult: any): any {
    // Analyze search results to determine if claim is supported
    const content = searchResult.content.toLowerCase();
    const claimLower = claim.toLowerCase();

    let status: 'verified' | 'contradicted' | 'uncertain';
    let confidence: number;

    if (content.includes(claimLower) || this.semanticMatch(content, claimLower)) {
      status = 'verified';
      confidence = Math.min(searchResult.sources[0]?.credibilityScore * 100 || 50, 95);
    } else if (content.includes('not') || content.includes('false') || content.includes('incorrect')) {
      status = 'contradicted';
      confidence = 70;
    } else {
      status = 'uncertain';
      confidence = 30;
    }

    return {
      status,
      confidence,
      sources: searchResult.sources.slice(0, 3),
      explanation: `Claim "${claim}" is ${status} based on available sources.`
    };
  }

  private semanticMatch(text1: string, text2: string): boolean {
    // Simple semantic matching - in production, use embeddings
    const words1 = text1.split(' ').filter(w => w.length > 3);
    const words2 = text2.split(' ').filter(w => w.length > 3);
    
    const overlap = words2.filter(w => words1.includes(w)).length;
    return overlap / words2.length > 0.5;
  }

  // Response parsing methods
  private parseAnalysisResponse(content: string): any {
    // Parse AI response into structured format
    return {
      keyFindings: this.extractSection(content, 'key findings', 'findings'),
      consensus: this.extractSection(content, 'consensus', 'agreement'),
      contradictions: this.extractSection(content, 'contradictions', 'disagreements'),
      confidence: this.extractConfidenceLevel(content),
      gaps: this.extractSection(content, 'gaps', 'missing')
    };
  }

  private parseOutlineResponse(content: string, topic: string): ResearchOutline {
    // Parse outline from AI response
    const subtopics = this.extractSubtopics(content);
    
    return {
      mainTopic: topic,
      subtopics,
      methodology: this.extractSection(content, 'methodology', 'approach').join(' '),
      expectedDuration: subtopics.length * 60000 // 1 minute per subtopic estimate
    };
  }

  private parseGapAnalysis(content: string): any {
    return {
      gaps: this.extractSection(content, 'knowledge gaps', 'missing information'),
      contradictions: this.extractSection(content, 'contradictions', 'disagreements'),
      uncertainties: this.extractSection(content, 'uncertainties', 'unclear'),
      futureDirections: this.extractSection(content, 'future research', 'next steps'),
      limitations: this.extractSection(content, 'limitations', 'biases')
    };
  }

  private parseCriticalEvaluation(content: string): any {
    return {
      biases: this.extractSection(content, 'biases', 'bias'),
      limitations: this.extractSection(content, 'limitations', 'limited'),
      alternatives: this.extractSection(content, 'alternative', 'other interpretations'),
      evidenceStrength: this.extractSection(content, 'evidence', 'strength')
    };
  }

  private extractSection(content: string, ...keywords: string[]): string[] {
    const lines = content.split('\n');
    const results: string[] = [];
    let inSection = false;

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      
      if (keywords.some(k => lineLower.includes(k))) {
        inSection = true;
        continue;
      }
      
      if (inSection && line.trim().startsWith('-')) {
        results.push(line.trim().substring(1).trim());
      } else if (inSection && line.trim() === '') {
        inSection = false;
      }
    }

    return results;
  }

  private extractSubtopics(content: string): ResearchSubtopic[] {
    const subtopics: ResearchSubtopic[] = [];
    const lines = content.split('\n');
    
    let currentSubtopic: ResearchSubtopic | null = null;
    let subtopicIndex = 0;

    for (const line of lines) {
      if (line.match(/^\d+\.|^[A-Z]\.|^-\s+[A-Z]/)) {
        if (currentSubtopic) {
          subtopics.push(currentSubtopic);
        }
        
        currentSubtopic = {
          id: `subtopic_${subtopicIndex++}`,
          title: line.replace(/^\d+\.|^[A-Z]\.|^-\s+/, '').trim(),
          questions: [],
          priority: subtopicIndex <= 3 ? 'high' : subtopicIndex <= 6 ? 'medium' : 'low',
          status: 'pending'
        };
      } else if (currentSubtopic && line.trim().startsWith('?')) {
        currentSubtopic.questions.push(line.trim());
      }
    }

    if (currentSubtopic) {
      subtopics.push(currentSubtopic);
    }

    return subtopics;
  }

  private extractConfidenceLevel(content: string): number {
    const confidenceMatch = content.match(/confidence[:\s]+(\d+)%?/i);
    if (confidenceMatch) {
      return parseInt(confidenceMatch[1]) / 100;
    }
    
    // Heuristic based on language
    if (content.includes('highly confident') || content.includes('strong evidence')) return 0.9;
    if (content.includes('moderately confident') || content.includes('some evidence')) return 0.7;
    if (content.includes('low confidence') || content.includes('limited evidence')) return 0.4;
    
    return 0.6; // Default moderate confidence
  }
}