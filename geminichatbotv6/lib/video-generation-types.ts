export interface GeneratedVideo {
  id: string;
  prompt: string;
  url: string;
  thumbnailUrl?: string;
  duration: 5 | 10;
  aspectRatio: "16:9" | "9:16" | "1:1";
  model: 'standard' | 'pro';
  sourceImage?: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  finalElapsedTime?: number; // Final elapsed time in seconds when generation completes
  error?: string;
}

export interface VideoGenerationSettings {
  model: 'standard' | 'pro';
  defaultDuration: 5 | 10;
  defaultAspectRatio: "16:9" | "9:16" | "1:1";
  defaultNegativePrompt?: string;
}

export interface VideoGenerationInput {
  prompt: string;
  duration?: 5 | 10;
  cfg_scale?: number;
  start_image?: string;
  end_image?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  negative_prompt?: string;
  reference_images?: string[];
}