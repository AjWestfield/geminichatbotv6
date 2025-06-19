"use client"

import { motion } from 'framer-motion';
import { Loader2, Video, X, Clock, Zap } from 'lucide-react';
import { useVideoProgressStore } from '@/lib/stores/video-progress-store';
import { GeneratedVideo } from '@/lib/video-generation-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface VideoLoadingCardProps {
  video: GeneratedVideo;
  className?: string;
  onCancel?: (videoId: string) => void;
  showCancel?: boolean;
}

export function VideoLoadingCard({ video, className, onCancel, showCancel = true }: VideoLoadingCardProps) {
  const { getProgress } = useVideoProgressStore();
  const [currentTime, setCurrentTime] = useState(Date.now());

  const progress = getProgress(video.id);

  // Update current time every second for accurate elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format time helpers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatElapsed = () => {
    if (!progress?.createdAt) return '0:00';
    const elapsed = Math.floor((currentTime - progress.createdAt.getTime()) / 1000);
    return formatTime(elapsed);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'initializing': return 'text-blue-400';
      case 'processing': return 'text-purple-400';
      case 'finalizing': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'initializing': return <Clock className="h-4 w-4" />;
      case 'processing': return <Zap className="h-4 w-4" />;
      case 'finalizing': return <Video className="h-4 w-4" />;
      default: return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  return (
    <div className={cn(
      "relative aspect-video bg-gray-800 rounded-lg overflow-hidden group",
      className
    )}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-purple-900/20"
          animate={{
            background: [
              "linear-gradient(45deg, rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))",
              "linear-gradient(225deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1))",
              "linear-gradient(45deg, rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))"
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-shimmer opacity-50" />
      </div>

      {/* Source image thumbnail overlay */}
      {video.sourceImage && (
        <div className="absolute inset-0 z-10">
          <img
            src={video.sourceImage}
            alt="Source image"
            className="w-full h-full object-cover opacity-30 blur-sm"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Progress overlay - optimized spacing */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-20">
        {/* Top section: Model info and elapsed time */}
        <div className="mb-3 text-center">
          <div className="text-sm font-medium text-white">
            Kling v1.6 {video.model === 'pro' ? 'Pro' : 'Standard'}
          </div>
          <div className="text-xs text-blue-400 font-mono mt-0.5">
            Elapsed: {formatElapsed()}
          </div>
        </div>

        {/* Main loading indicator */}
        <div className="mb-3">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="h-10 w-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("transition-colors duration-300", getStageColor(progress?.stage || 'initializing'))}>
                {getStageIcon(progress?.stage || 'initializing')}
              </div>
            </div>
          </div>
        </div>

        {/* Stage indicator dots */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300",
            progress?.stage === 'initializing' ? 'bg-blue-400 scale-125' : 'bg-gray-600'
          )} />
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300",
            progress?.stage === 'processing' ? 'bg-purple-400 scale-125' :
            ['finalizing', 'completed'].includes(progress?.stage || '') ? 'bg-purple-400' : 'bg-gray-600'
          )} />
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300",
            progress?.stage === 'finalizing' || progress?.stage === 'completed' ? 'bg-green-400 scale-125' : 'bg-gray-600'
          )} />
        </div>

        {/* Status text */}
        <p className="text-xs text-white/90 font-medium mb-3 text-center px-4 line-clamp-2">
          {progress?.stageMessage || "Initializing video generation..."}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-[280px] mb-3">
          <div className="h-2.5 bg-gray-700/50 rounded-full overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-sm"
              initial={{ width: 0 }}
              animate={{ width: `${progress?.progress || 0}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {/* Progress details - improved visibility */}
          <div className="mt-2 flex flex-col items-center space-y-1">
            <div className="text-base font-bold text-white">
              {progress?.progress || 0}%
            </div>
            {progress?.estimatedRemainingTime !== undefined && (
              <div className="text-xs text-gray-300 font-medium">
                ~{formatTime(progress.estimatedRemainingTime)} remaining
              </div>
            )}
          </div>
        </div>

        {/* Cancel button */}
        {showCancel && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={() => onCancel(video.id)}
          >
            <X className="h-3 w-3 mr-0.5" />
            Cancel
          </Button>
        )}
      </div>

      {/* Bottom info bar - minimal info to not overlap with progress */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 z-30">
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-gray-400">{video.duration}s</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">{video.aspectRatio || '9:16'}</span>
          {video.model && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 capitalize">{video.model}</span>
            </>
          )}
        </div>
      </div>

      {/* Animated border effect */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <motion.div
          className="absolute inset-0 border-2 rounded-lg"
          animate={{
            borderColor: [
              "rgba(147, 51, 234, 0.3)",
              "rgba(59, 130, 246, 0.3)",
              "rgba(147, 51, 234, 0.3)"
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute inset-0 border rounded-lg"
          animate={{
            borderColor: [
              "rgba(147, 51, 234, 0.6)",
              "rgba(59, 130, 246, 0.6)",
              "rgba(147, 51, 234, 0.6)"
            ],
            scale: [1, 1.005, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
    </div>
  );
}
