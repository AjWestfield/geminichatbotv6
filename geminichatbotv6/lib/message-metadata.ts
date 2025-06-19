import { Message } from 'ai'
import { FileUpload } from '@/components/chat-interface'

export interface EnhancedMessage extends Message {
  attachments?: FileUpload[]
  metadata?: {
    searchResults?: {
      sources?: Array<{
        name: string
        url: string
        snippet?: string
      }>
      images?: Array<{
        url: string
        title?: string
        source?: string
      }>
      relatedQuestions?: string[]
    }
    videoGeneration?: {
      videoId: string
      prompt: string
      status: string
    }
    imageGeneration?: {
      imageIds: string[]
      prompt: string
    }
    audioGeneration?: {
      audioId: string
      prompt: string
    }
    socialMediaDownload?: {
      url: string
      platform: string
      content: any
    }
  }
}

/**
 * Extract metadata from message content
 * This includes search results, video/image/audio generation data, etc.
 */
export function extractMessageMetadata(message: Message): EnhancedMessage['metadata'] {
  const metadata: EnhancedMessage['metadata'] = {}
  
  // Extract search results metadata
  const searchMetadataMatch = message.content.match(/\[SEARCH_METADATA\]([\s\S]*?)\[\/SEARCH_METADATA\]/)
  if (searchMetadataMatch) {
    try {
      const searchData = JSON.parse(searchMetadataMatch[1])
      metadata.searchResults = searchData
    } catch (e) {
      console.error('Failed to parse search metadata:', e)
    }
  }
  
  // Extract video generation data
  const videoMatch = message.content.match(/\[VIDEO_GENERATION_STARTED\]([\s\S]*?)\[\/VIDEO_GENERATION_STARTED\]/)
  if (videoMatch) {
    try {
      metadata.videoGeneration = JSON.parse(videoMatch[1])
    } catch (e) {
      console.error('Failed to parse video generation data:', e)
    }
  }
  
  // Extract image generation data
  const imageMatch = message.content.match(/\[IMAGE_GENERATION\]([\s\S]*?)\[\/IMAGE_GENERATION\]/)
  if (imageMatch) {
    try {
      metadata.imageGeneration = JSON.parse(imageMatch[1])
    } catch (e) {
      console.error('Failed to parse image generation data:', e)
    }
  }
  
  // Extract audio generation data
  const audioMatch = message.content.match(/\[AUDIO_GENERATION\]([\s\S]*?)\[\/AUDIO_GENERATION\]/)
  if (audioMatch) {
    try {
      metadata.audioGeneration = JSON.parse(audioMatch[1])
    } catch (e) {
      console.error('Failed to parse audio generation data:', e)
    }
  }
  
  // Extract social media download data
  const socialMatch = message.content.match(/\[SOCIAL_MEDIA_DOWNLOAD\]([\s\S]*?)\[\/SOCIAL_MEDIA_DOWNLOAD\]/)
  if (socialMatch) {
    try {
      metadata.socialMediaDownload = JSON.parse(socialMatch[1])
    } catch (e) {
      console.error('Failed to parse social media download data:', e)
    }
  }
  
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

/**
 * Clean message content for display (remove metadata markers)
 */
export function cleanMessageContent(content: string): string {
  return content
    .replace(/\[SEARCH_METADATA\][\s\S]*?\[\/SEARCH_METADATA\]/g, '')
    .replace(/\[VIDEO_GENERATION_STARTED\][\s\S]*?\[\/VIDEO_GENERATION_STARTED\]/g, '')
    .replace(/\[IMAGE_GENERATION\][\s\S]*?\[\/IMAGE_GENERATION\]/g, '')
    .replace(/\[AUDIO_GENERATION\][\s\S]*?\[\/AUDIO_GENERATION\]/g, '')
    .replace(/\[SOCIAL_MEDIA_DOWNLOAD\][\s\S]*?\[\/SOCIAL_MEDIA_DOWNLOAD\]/g, '')
    .replace(/\[IMAGE_OPTIONS\][\s\S]*?\[\/IMAGE_OPTIONS\]/g, '')
    .replace(/\[VIDEO_OPTIONS\][\s\S]*?\[\/VIDEO_OPTIONS\]/g, '')
    .replace(/\[FORCE_WEB_SEARCH\]/g, '')
    .trim()
}

/**
 * Reconstruct message with metadata for display
 */
export function reconstructMessageWithMetadata(
  message: Message, 
  metadata?: EnhancedMessage['metadata']
): Message {
  let content = cleanMessageContent(message.content)
  
  // Add metadata back as markers if needed
  if (metadata?.searchResults) {
    content += `\n[SEARCH_METADATA]${JSON.stringify(metadata.searchResults)}[/SEARCH_METADATA]`
  }
  
  if (metadata?.videoGeneration) {
    content += `\n[VIDEO_GENERATION_STARTED]${JSON.stringify(metadata.videoGeneration)}[/VIDEO_GENERATION_STARTED]`
  }
  
  if (metadata?.imageGeneration) {
    content += `\n[IMAGE_GENERATION]${JSON.stringify(metadata.imageGeneration)}[/IMAGE_GENERATION]`
  }
  
  if (metadata?.audioGeneration) {
    content += `\n[AUDIO_GENERATION]${JSON.stringify(metadata.audioGeneration)}[/AUDIO_GENERATION]`
  }
  
  if (metadata?.socialMediaDownload) {
    content += `\n[SOCIAL_MEDIA_DOWNLOAD]${JSON.stringify(metadata.socialMediaDownload)}[/SOCIAL_MEDIA_DOWNLOAD]`
  }
  
  return {
    ...message,
    content
  }
}
