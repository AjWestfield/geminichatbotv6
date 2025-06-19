'use client';

import React, { useState } from 'react';
import { useDeepResearch } from '@/hooks/use-deep-research';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function DeepResearchPage() {
  const [query, setQuery] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('high');
  const { data, loading, error, startResearch, cancelResearch, exportAsMarkdown } = useDeepResearch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    await startResearch(query, {
      reasoningEffort,
      onProgress: (job) => {
        console.log('Research progress:', job);
      },
      onComplete: (job) => {
        console.log('Research complete:', job);
      },
      onError: (error) => {
        console.error('Research error:', error);
      }
    });
  };

  const handleExport = () => {
    const markdown = exportAsMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${data?.jobId || 'export'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = () => {
    if (!data) return null;
    
    switch (data.status) {
      case 'queued':
        return <Clock className="h-5 w-5" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-6 w-6" />
            Perplexity Deep Research
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="query" className="text-sm font-medium">
                Research Question
              </label>
              <Textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your research question or topic..."
                className="min-h-[100px]"
                disabled={loading}
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <label htmlFor="effort" className="text-sm font-medium">
                  Reasoning Effort
                </label>
                <Select
                  value={reasoningEffort}
                  onValueChange={(value) => setReasoningEffort(value as 'low' | 'medium' | 'high')}
                  disabled={loading}
                >
                  <SelectTrigger id="effort" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Fast)</SelectItem>
                    <SelectItem value="medium">Medium (Balanced)</SelectItem>
                    <SelectItem value="high">High (Thorough)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1" />
              
              <div className="flex gap-2">
                {loading ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={cancelResearch}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button type="submit" disabled={!query.trim()}>
                    <Search className="h-4 w-4 mr-2" />
                    Start Research
                  </Button>
                )}
              </div>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Status Display */}
          {data && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon()}
                  <div>
                    <p className="font-medium">Research Status</p>
                    <p className="text-sm text-muted-foreground">
                      Job ID: <code className="font-mono">{data.jobId}</code>
                    </p>
                  </div>
                </div>
                <Badge variant={
                  data.status === 'completed' ? 'default' :
                  data.status === 'failed' ? 'destructive' :
                  'secondary'
                }>
                  {data.status}
                </Badge>
              </div>

              {/* Results Display */}
              {data.response && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Research Results</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExport}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{data.response.content}</ReactMarkdown>
                      </div>
                      
                      {data.response.searchResults && data.response.searchResults.length > 0 && (
                        <div className="mt-8 space-y-2">
                          <h3 className="font-semibold">Sources</h3>
                          <div className="space-y-2">
                            {data.response.searchResults.map((result: any, index: number) => (
                              <div key={index} className="p-3 border rounded-lg hover:bg-muted/50">
                                <a
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium hover:underline"
                                >
                                  {result.title || 'Untitled'}
                                </a>
                                {result.snippet && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {result.snippet}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}