"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronRight,
  ChevronDown,
  FileText,
  Target,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchOutline, ResearchSubtopic } from "@/lib/langgraph/agents/deep-research-agent";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ResearchOutlineProps {
  outline: ResearchOutline | null;
  onSubtopicToggle?: (subtopicId: string) => void;
  className?: string;
}

export function ResearchOutline({ 
  outline, 
  onSubtopicToggle,
  className 
}: ResearchOutlineProps) {
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());

  if (!outline) {
    return null;
  }

  const toggleSubtopic = (subtopicId: string) => {
    setExpandedSubtopics(prev => {
      const next = new Set(prev);
      if (next.has(subtopicId)) {
        next.delete(subtopicId);
      } else {
        next.add(subtopicId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: ResearchSubtopic['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'researching':
        return <Circle className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: ResearchSubtopic['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const completedCount = outline.subtopics.filter(s => s.status === 'completed').length;
  const progressPercentage = outline.subtopics.length > 0 
    ? Math.round((completedCount / outline.subtopics.length) * 100)
    : 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Research Outline
        </CardTitle>
        <CardDescription>
          {outline.mainTopic}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress: {completedCount}/{outline.subtopics.length} topics</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Methodology */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Target className="h-3 w-3" />
            Methodology
          </h4>
          <p className="text-sm text-muted-foreground">{outline.methodology}</p>
        </div>

        {/* Estimated Duration */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            Estimated duration: {Math.round(outline.expectedDuration / 60000)} minutes
          </span>
        </div>

        {/* Subtopics */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Research Topics</h4>
          <ScrollArea className="h-[300px] pr-2">
            <div className="space-y-2">
              {outline.subtopics.map((subtopic) => (
                <Collapsible
                  key={subtopic.id}
                  open={expandedSubtopics.has(subtopic.id)}
                  onOpenChange={() => toggleSubtopic(subtopic.id)}
                >
                  <Card className="p-0">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          {getStatusIcon(subtopic.status)}
                          <span className={cn(
                            "text-sm font-medium flex-1 text-left",
                            subtopic.status === 'completed' && "line-through text-muted-foreground"
                          )}>
                            {subtopic.title}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPriorityColor(subtopic.priority))}
                          >
                            {subtopic.priority}
                          </Badge>
                          {expandedSubtopics.has(subtopic.id) ? 
                            <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          }
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 pt-0 space-y-3">
                        {/* Questions */}
                        {subtopic.questions.length > 0 && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-medium text-gray-600">Research Questions:</h5>
                            <ul className="space-y-1">
                              {subtopic.questions.map((question, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                  <span className="text-gray-400 mt-0.5">•</span>
                                  <span>{question}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Findings */}
                        {subtopic.findings && subtopic.findings.length > 0 && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-medium text-green-600">Findings:</h5>
                            <ul className="space-y-1">
                              {subtopic.findings.map((finding, i) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{finding}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Toggle Selection */}
                        {onSubtopicToggle && subtopic.status === 'pending' && (
                          <div className="flex items-center space-x-2 pt-2">
                            <Checkbox 
                              id={`include-${subtopic.id}`}
                              checked={true}
                              onCheckedChange={() => onSubtopicToggle(subtopic.id)}
                            />
                            <label 
                              htmlFor={`include-${subtopic.id}`}
                              className="text-xs text-gray-600 cursor-pointer"
                            >
                              Include in research
                            </label>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-gray-400" />
            <span>Pending ({outline.subtopics.filter(s => s.status === 'pending').length})</span>
          </div>
          <div className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-blue-500" />
            <span>Researching ({outline.subtopics.filter(s => s.status === 'researching').length})</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>Completed ({completedCount})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}