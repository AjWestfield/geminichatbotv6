import { useEffect, useState, useCallback } from 'react';
import { settingsSync } from '@/lib/settings-sync';

/**
 * Hook to use a synced setting value
 * Automatically updates when the setting changes
 */
export function useSyncedSetting<T = string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    return settingsSync.get(key, defaultValue) as T;
  });

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = settingsSync.subscribe((changedKey, newValue) => {
      if (changedKey === key) {
        console.log(`[useSyncedSetting] ${key} changed to:`, newValue);
        setValue(newValue as T);
      }
    });

    // Get the latest value on mount
    const currentValue = settingsSync.get(key, defaultValue) as T;
    if (currentValue !== value) {
      setValue(currentValue);
    }

    return unsubscribe;
  }, [key, defaultValue]);

  const updateValue = useCallback((newValue: T) => {
    console.log(`[useSyncedSetting] Updating ${key} to:`, newValue);
    settingsSync.set(key, newValue);
    setValue(newValue);
  }, [key]);

  return [value, updateValue];
}

/**
 * Hook for image generation settings
 */
export function useImageGenerationSettings() {
  const [model, setModel] = useSyncedSetting('imageGenerationModel', 'flux-kontext-pro');
  const [editingModel, setEditingModel] = useSyncedSetting('imageEditingModel', 'flux-kontext-pro');
  const [style, setStyle] = useSyncedSetting<'vivid' | 'natural'>('imageStyle', 'vivid');
  const [size, setSize] = useSyncedSetting<'1024x1024' | '1792x1024' | '1024x1536'>('imageSize', '1024x1024');
  const [quality, setQuality] = useSyncedSetting<'standard' | 'hd'>('imageQuality', 'standard');

  return {
    model,
    setModel,
    editingModel,
    setEditingModel,
    style,
    setStyle,
    size,
    setSize,
    quality,
    setQuality
  };
}

/**
 * Hook for video generation settings
 */
export function useVideoGenerationSettings() {
  const [model, setModel] = useSyncedSetting<'standard' | 'pro'>('videoModel', 'standard');
  const [duration, setDuration] = useSyncedSetting<5 | 10>('videoDuration', 5);
  const [aspectRatio, setAspectRatio] = useSyncedSetting<'16:9' | '9:16' | '1:1'>('videoAspectRatio', '16:9');

  return {
    model,
    setModel,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio
  };
}

/**
 * Hook for chat model settings
 */
export function useChatModelSettings() {
  const [model, setModel] = useSyncedSetting('selectedModel', 'gemini-2.5-pro-preview-06-05');

  return {
    model,
    setModel
  };
}