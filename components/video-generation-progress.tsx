"use client"

import { motion } from 'framer-motion';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoProgress } from '@/hooks/use-video-progress';
import { cn } from '@/lib/utils';

interface VideoGenerationProgressProps {
  videoId: string;
  prompt: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function VideoGenerationProgress({ 
  videoId, 
  prompt, 
  onCancel,
  onRetry,
  className 
}: VideoGenerationProgressProps) {
  const { progress, error, formatTime, formatElapsed } = useVideoProgress(videoId);
  
  if (!progress) {
    return null;
  }
  
  const isError = progress.status === 'failed' || !!error;
  const isComplete = progress.status === 'succeeded';
  
  return (
    <div className={cn(
      "mt-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <p className="text-sm font-medium text-gray-200 line-clamp-1">
            {prompt}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {progress.stage || 'Preparing...'}
          </p>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onCancel && !isComplete && !isError && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 px-2 text-gray-400 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          {onRetry && isError && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2 text-gray-400 hover:text-blue-400"
            >
              Retry
            </Button>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      {!isError && (
        <div className="mb-3">
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              className={cn(
                "absolute h-full",
                isComplete ? "bg-green-500" : "bg-purple-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            
            {/* Shimmer effect for active generation */}
            {!isComplete && progress.status === 'processing' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            )}
          </div>
          
          {/* Progress text */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">
              {progress.progress}%
            </span>
            
            <div className="flex items-center gap-3 text-gray-500">
              <span>{formatElapsed()}</span>
              {progress.estimatedTimeRemaining > 0 && (
                <>
                  <span>/</span>
                  <span>{formatTime(progress.estimatedTimeRemaining)} remaining</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {isError && (
        <div className="flex items-start gap-2 text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            {error || progress.error || 'Video generation failed'}
          </p>
        </div>
      )}
      
      {/* Loading spinner for early stages */}
      {progress.status === 'starting' && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Initializing...</span>
        </div>
      )}
    </div>
  );
}