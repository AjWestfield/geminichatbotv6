'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward,
  Volume2,
  Maximize2,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RRWebPlayerProps {
  events: any[];
  isLive?: boolean;
  className?: string;
  onPlaybackChange?: (playing: boolean) => void;
  onPositionChange?: (position: number) => void;
}

export function RRWebPlayer({ 
  events, 
  isLive = false, 
  className,
  onPlaybackChange,
  onPositionChange 
}: RRWebPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(isLive);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize rrweb player
  useEffect(() => {
    if (!playerRef.current || events.length === 0) return;

    const initializePlayer = async () => {
      setIsLoading(true);
      
      try {
        // Dynamically import rrweb-player to avoid SSR issues
        const { Replayer } = await import('rrweb-player');
        
        // Clear previous player
        if (replayerRef.current) {
          replayerRef.current.destroy?.();
        }

        // Create new replayer instance
        const replayer = new Replayer(events, {
          target: playerRef.current,
          props: {
            width: playerRef.current.offsetWidth,
            height: playerRef.current.offsetHeight,
            autoPlay: isLive,
            speedOption: [0.5, 1, 1.5, 2, 4],
            showController: !isLive,
            tags: {
              'viewport': 'width=device-width, initial-scale=1'
            }
          }
        });

        replayerRef.current = replayer;

        // Set up event listeners
        replayer.on('start', () => {
          setIsPlaying(true);
          onPlaybackChange?.(true);
        });

        replayer.on('pause', () => {
          setIsPlaying(false);
          onPlaybackChange?.(false);
        });

        replayer.on('finish', () => {
          setIsPlaying(false);
          onPlaybackChange?.(false);
        });

        replayer.on('progress', (progress: any) => {
          setCurrentTime(progress.timeOffset);
          onPositionChange?.(progress.timeOffset);
        });

        // Calculate duration
        if (events.length > 1) {
          const lastEvent = events[events.length - 1];
          const firstEvent = events[0];
          setDuration(lastEvent.timestamp - firstEvent.timestamp);
        }

        console.log('[RRWebPlayer] Initialized with', events.length, 'events');
        
      } catch (error) {
        console.error('[RRWebPlayer] Failed to initialize:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializePlayer();

    return () => {
      if (replayerRef.current) {
        replayerRef.current.destroy?.();
        replayerRef.current = null;
      }
    };
  }, [events, isLive, onPlaybackChange, onPositionChange]);

  // Add new events in live mode
  useEffect(() => {
    if (isLive && replayerRef.current && events.length > 0) {
      try {
        // In live mode, we need to add new events as they come
        const lastEvent = events[events.length - 1];
        replayerRef.current.addEvent?.(lastEvent);
      } catch (error) {
        console.error('[RRWebPlayer] Failed to add live event:', error);
      }
    }
  }, [events, isLive]);

  const handlePlayPause = () => {
    if (!replayerRef.current) return;

    if (isPlaying) {
      replayerRef.current.pause();
    } else {
      replayerRef.current.play();
    }
  };

  const handleRestart = () => {
    if (!replayerRef.current) return;
    replayerRef.current.goto(0);
    replayerRef.current.play();
  };

  const handleSpeedChange = (speed: number) => {
    if (!replayerRef.current) return;
    setPlaybackSpeed(speed);
    replayerRef.current.setConfig({ speed });
  };

  const handleSeek = (value: number[]) => {
    if (!replayerRef.current || duration === 0) return;
    const time = (value[0] / 100) * duration;
    replayerRef.current.goto(time);
    setCurrentTime(time);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex flex-col h-full bg-gray-50", className)}>
      {/* Player Container */}
      <div className="flex-1 relative bg-white overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading session...</p>
            </div>
          </div>
        )}
        
        <div ref={playerRef} className="w-full h-full" />
        
        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-4 right-4">
            <Badge variant="destructive" className="gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </Badge>
          </div>
        )}
      </div>

      {/* Custom Controls (only for playback mode) */}
      {!isLive && events.length > 0 && (
        <div className="bg-white border-t p-3 space-y-3">
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground min-w-[3rem]">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground min-w-[3rem]">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                disabled={isLoading}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => replayerRef.current?.goto(Math.max(0, currentTime - 10000))}
                disabled={isLoading}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayPause}
                disabled={isLoading}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => replayerRef.current?.goto(Math.min(duration, currentTime + 10000))}
                disabled={isLoading}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Speed Control */}
              <div className="flex items-center gap-1">
                {[0.5, 1, 1.5, 2].map((speed) => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSpeedChange(speed)}
                    className="px-2"
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
              
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No Events State */}
      {events.length === 0 && !isLoading && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No session data available</p>
            <p className="text-xs">The agent session will appear here when it starts</p>
          </div>
        </div>
      )}
    </div>
  );
}