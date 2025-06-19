'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Zap, 
  Globe,
  Activity,
  Sparkles
} from 'lucide-react';
import { AgentCanvas } from './agent-canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeepResearchButtonProps {
  onStartResearch?: (query: string) => void;
  disabled?: boolean;
  query?: string;
}

export function DeepResearchButton({ 
  onStartResearch, 
  disabled = false,
  query = ''
}: DeepResearchButtonProps) {
  const [isAgentCanvasOpen, setIsAgentCanvasOpen] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');

  const handleClick = () => {
    const researchQuery = query.trim() || 'Research and analyze the latest trends in AI technology';
    setCurrentQuery(researchQuery);
    setIsAgentCanvasOpen(true);
    onStartResearch?.(researchQuery);
  };

  const handleClose = () => {
    setIsAgentCanvasOpen(false);
    setCurrentQuery('');
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled}
        className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
        size="sm"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="h-4 w-4" />
            <Sparkles className="h-2 w-2 absolute -top-1 -right-1 text-yellow-300" />
          </div>
          <span className="font-medium">Agentic Research</span>
        </div>
        <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
          <Zap className="h-3 w-3 mr-1" />
          AI
        </Badge>
      </Button>

      {/* Agent Canvas Modal */}
      <Dialog open={isAgentCanvasOpen} onOpenChange={setIsAgentCanvasOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Agentic Research Canvas</DialogTitle>
          </DialogHeader>
          <div className="h-[90vh]">
            <AgentCanvas 
              query={currentQuery}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}