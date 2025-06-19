'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResearchWebView } from './research-web-view';
import { useDeepResearchStore, ResearchSession } from '@/lib/stores/deep-research-store';
import { WebAction } from '@/lib/services/browser-automation';
import {
  Search,
  FileText,
  Globe,
  Brain,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  X,
  Loader2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface DeepResearchPanelProps {
  sessionId?: string;
  onClose?: () => void;
  className?: string;
}

export function DeepResearchPanel({
  sessionId,
  onClose,
  className = ''
}: DeepResearchPanelProps) {
  const {
    getSession,
    getActiveSession,
    updateSession,
    completePhase,
    exportSession
  } = useDeepResearchStore();

  const session = sessionId ? getSession(sessionId) : getActiveSession();

  if (!session) {
    return null;
  }

  const handleWebViewAction = (action: WebAction, params?: any) => {
    console.log('Web view action:', action, params);
    // Handle web view interactions
    // This would be connected to the browser automation service
  };

  const handleExport = () => {
    const markdown = exportSession(session.id);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${session.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: ResearchSession['status']) => {
    switch (status) {
      case 'idle':
        return <Clock className="h-4 w-4" />;
      case 'planning':
      case 'researching':
      case 'analyzing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getProgress = () => {
    if (session.phases.length === 0) return 0;
    const completed = session.phases.filter(p => p.status === 'completed').length;
    return (completed / session.phases.length) * 100;
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5" />
              <CardTitle>Deep Research</CardTitle>
              <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                {session.mode}
              </Badge>
              {getStatusIcon(session.status)}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                disabled={!session.report}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              {onClose && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Query:</strong> {session.query}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <span>Depth: <Badge variant="outline">{session.depth}</Badge></span>
              <span>Started: {new Date(session.startedAt).toLocaleTimeString()}</span>
              {session.completedAt && (
                <span>Duration: {Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000)}s</span>
              )}
            </div>
            <Progress value={getProgress()} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <Tabs defaultValue="progress" className="flex-1 flex flex-col">
            <TabsList className="mx-6">
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="findings">Findings</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
              {session.mode === 'interactive' && (
                <TabsTrigger value="web">Web View</TabsTrigger>
              )}
              {session.report && (
                <TabsTrigger value="report">Report</TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="progress" className="h-full m-0">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-4">
                    {session.phases.map((phase, index) => (
                      <div
                        key={phase.name}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-shrink-0 mt-1">
                          {phase.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : phase.status === 'active' ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">
                              {phase.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            {phase.completedAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(phase.completedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {phase.findings.length > 0 && (
                            <div className="space-y-1">
                              {phase.findings.slice(0, 3).map((finding, i) => (
                                <p key={i} className="text-sm text-muted-foreground">
                                  • {finding}
                                </p>
                              ))}
                              {phase.findings.length > 3 && (
                                <p className="text-sm text-muted-foreground">
                                  ...and {phase.findings.length - 3} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Async Jobs */}
                    {session.asyncJobs.size > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-3">Async Jobs</h4>
                        {Array.from(session.asyncJobs.values()).map(job => (
                          <div
                            key={job.jobId}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Search className="h-4 w-4" />
                              <span className="text-sm font-mono">{job.jobId}</span>
                            </div>
                            <Badge variant={
                              job.status === 'completed' ? 'default' :
                              job.status === 'failed' ? 'destructive' :
                              'secondary'
                            }>
                              {job.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="findings" className="h-full m-0">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-6">
                    {session.insights.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          Key Insights
                        </h4>
                        <div className="space-y-2">
                          {session.insights.map((insight, i) => (
                            <div key={i} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                              <p className="text-sm">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {session.contradictions.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          Contradictions Found
                        </h4>
                        <div className="space-y-2">
                          {session.contradictions.map((contradiction, i) => (
                            <div key={i} className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950">
                              <p className="text-sm">{contradiction}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {session.knowledgeGaps.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Search className="h-4 w-4 text-purple-500" />
                          Knowledge Gaps
                        </h4>
                        <div className="space-y-2">
                          {session.knowledgeGaps.map((gap, i) => (
                            <div key={i} className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950">
                              <p className="text-sm">{gap}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {session.findings.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">All Findings</h4>
                        <div className="space-y-2">
                          {session.findings.map((finding, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <p className="text-sm">{finding}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="sources" className="h-full m-0">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-3">
                    {session.sources.map((source, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <h5 className="font-medium line-clamp-1">
                              {source.title || 'Untitled Source'}
                            </h5>
                            {source.snippet && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {source.snippet}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {source.credibilityScore && (
                                <span>
                                  Credibility: {Math.round(source.credibilityScore * 100)}%
                                </span>
                              )}
                              {source.type && (
                                <Badge variant="outline" className="text-xs">
                                  {source.type}
                                </Badge>
                              )}
                              {source.date && (
                                <span>{new Date(source.date).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          {source.url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(source.url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {session.mode === 'interactive' && (
                <TabsContent value="web" className="h-full m-0 p-6">
                  {session.currentWebPage ? (
                    <ResearchWebView
                      url={session.currentWebPage.url}
                      context={session.currentWebPage}
                      onInteraction={handleWebViewAction}
                      className="h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center space-y-2">
                        <Globe className="h-12 w-12 mx-auto opacity-50" />
                        <p>No web page loaded</p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              {session.report && (
                <TabsContent value="report" className="h-full m-0">
                  <ScrollArea className="h-full px-6 py-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: session.report }} />
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}