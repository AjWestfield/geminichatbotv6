"use client"

import { cn, formatDuration, getFileExtension, formatVideoDuration } from "@/lib/utils"
import { FileAudio, Image as ImageIcon, Video } from "lucide-react"
import React, { useState, useMemo, useRef } from "react"
import { FilePreviewModal } from "./file-preview-modal"
import { ImageFocusModal } from "./image-focus-modal"
import { Button } from "@/components/ui/button"
import { MCPToolAnimation } from "./mcp-tool-animation"
import { MCPToolResult } from "./mcp-tool-result"
import { AnimatePresence } from "framer-motion"
import AgentPlan, { Task } from "@/components/ui/agent-plan"
import { VideoGenerationProgress } from "./video-generation-progress"
import { ImageOptionsCard } from "./image-options-card"
import { VideoOptionsCard } from "./video-options-card"
import { InlineImageOptions } from "./inline-image-options"
import { ImageOptionsPopup } from "./image-options-popup"
import { SearchResultsDisplay } from "./search-results-display"
import { extractReverseEngineeringPrompts, hasReverseEngineeringContent, extractReverseEngineeringMetadata } from "@/lib/reverse-engineering-utils"
import { CopyablePrompt } from "@/components/ui/copyable-prompt"
import { DeepResearchProgress } from "./deep-research-progress"
import { ImageUpscaleModal } from "./image-upscale-modal"

interface MessageAttachment {
  name: string
  contentType: string
  url?: string
  error?: string
  transcription?: {
    text: string
    language?: string
    duration?: number
    segments?: any[]
  }
  videoThumbnail?: string
  videoDuration?: number
  additionalFiles?: {
    name: string
    contentType: string
    url?: string
    transcription?: {
      text: string
      language?: string
      duration?: number
      segments?: any[]
    }
    videoThumbnail?: string
    videoDuration?: number
  }[]
}

interface MCPToolCall {
  id: string
  tool: string
  server: string
  status: 'executing' | 'completed' | 'failed'
  result?: any
  error?: string
  isExpanded: boolean
  timestamp: number
  duration?: number
}

interface ChatMessageProps {
  message: {
    id: string
    role: "user" | "assistant" | "system" | "function" | "data" | "tool"
    content: string
    createdAt?: Date
    experimental_attachments?: MessageAttachment[]
    toolCalls?: MCPToolCall[]
    agentPlan?: {
      tasks: Task[]
      onTaskUpdate?: (taskId: string, status: string) => void
      onSubtaskUpdate?: (taskId: string, subtaskId: string, status: string) => void
    }
  }
  mcpToolExecuting?: {
    messageId: string
    toolName: string
    serverName: string
    startTime: number
  } | null
  onAnimateImage?: (imageUrl: string, imageName: string) => void
  onEditImage?: (imageUrl: string, imageName: string) => void
  onImageOptionSelect?: (optionId: string, imageUri: string) => void
  onVideoOptionSelect?: (optionId: string, videoUri: string) => void
  onMultiImageOptionSelect?: (option: 'analyze' | 'edit' | 'animate' | 'multi-edit', attachment: MessageAttachment) => void
  onFollowUpClick?: (question: string) => void
  onReverseEngineeringAction?: (action: 'generate-image' | 'animate-image' | 'edit-image' | 'generate-variations', prompt: string, imageUri?: string) => void
  onGenerateVideo?: (prompt: string) => void
}

// Function to detect and extract agent plan from content
function extractAgentPlan(content: string): { tasks: Task[], cleanContent: string } | null {
  // Look for markers that indicate an agent plan
  const planMarkers = [
    /\[AGENT_PLAN\]([\s\S]*?)\[\/AGENT_PLAN\]/,
    /📋\s*(?:Task List|Plan|Workflow):\s*\n((?:[-•*]\s*.+\n?)+)/i,
    /(?:I'll|Let me)\s+(?:create|break down|organize)\s+(?:this|the)\s+(?:task|work|project)\s+into\s+(?:steps|tasks):\s*\n((?:\d+\.\s*.+\n?)+)/i
  ]

  for (const marker of planMarkers) {
    const match = content.match(marker)
    if (match) {
      const planText = match[1]
      const tasks: Task[] = []

      // Extract task lines
      const taskLines = planText.split('\n').filter(line => line.trim())
      taskLines.forEach((line, index) => {
        // Remove bullet points, numbers, etc.
        const cleanLine = line.replace(/^[-•*\d]+\.\s*/, '').trim()
        if (cleanLine) {
          tasks.push({
            id: `task-${index + 1}`,
            title: cleanLine,
            description: '',
            status: 'pending',
            priority: index === 0 ? 'high' : 'medium',
            level: 0,
            dependencies: index > 0 ? [`task-${index}`] : [],
            subtasks: []
          })
        }
      })

      if (tasks.length > 0) {
        // Remove the plan from content
        const cleanContent = content.replace(match[0], '').trim()
        return { tasks, cleanContent }
      }
    }
  }

  return null
}



// Enhanced markdown parser that supports HTML content for search results
function parseSimpleMarkdown(text: string) {
  // Check if the text contains HTML elements that indicate search results
  const hasSearchResultsHTML = text.includes('<div style=') &&
    (text.includes('### Related Images') || text.includes('### Sources'));

  if (hasSearchResultsHTML) {
    // For search results with HTML, render it directly
    // Note: This should only be used for trusted content from our own API
    return (
      <div
        className="search-results-content"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  // Helper function to get margin class based on indent level
  const getIndentClass = (indent: number): string => {
    const pixels = Math.min(indent * 16, 64);
    // Use predefined Tailwind classes for common indent levels
    const indentMap: { [key: number]: string } = {
      0: '',
      16: 'ml-4',
      32: 'ml-8',
      48: 'ml-12',
      64: 'ml-16'
    };
    return indentMap[pixels] || '';
  };

  // Enhanced markdown parser with support for more elements
  const parseMarkdownLine = (line: string, lineKey: string): React.ReactNode => {
    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const className = {
        1: 'text-2xl font-bold mb-2 mt-4',
        2: 'text-xl font-bold mb-2 mt-3',
        3: 'text-lg font-semibold mb-1 mt-2',
        4: 'text-base font-semibold mb-1 mt-2',
        5: 'text-sm font-semibold mb-1 mt-1',
        6: 'text-sm font-semibold mb-1 mt-1'
      }[level] || 'font-semibold';

      return <div key={lineKey} className={className}>{parseInlineMarkdown(content)}</div>;
    }

    // Handle bullet lists
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const content = bulletMatch[3];
      const indentClass = getIndentClass(indent);

      return (
        <div key={lineKey} className={cn("flex items-start mb-1", indentClass)}>
          <span className="mr-2 text-gray-400">•</span>
          <span className="flex-1">{parseInlineMarkdown(content)}</span>
        </div>
      );
    }

    // Handle numbered lists
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const indent = numberedMatch[1].length;
      const number = numberedMatch[2];
      const content = numberedMatch[3];
      const indentClass = getIndentClass(indent);

      return (
        <div key={lineKey} className={cn("flex items-start mb-1", indentClass)}>
          <span className="mr-2 text-gray-400">{number}.</span>
          <span className="flex-1">{parseInlineMarkdown(content)}</span>
        </div>
      );
    }

    // Handle code blocks (triple backticks)
    if (line.startsWith('```')) {
      return null; // Code block markers are handled separately
    }

    // Handle horizontal rules
    if (line.match(/^[-*_]{3,}$/)) {
      return <hr key={lineKey} className="my-4 border-gray-600" />;
    }

    // Regular line with inline markdown
    return (
      <div key={lineKey} className={line.trim() === '' ? 'mb-2' : 'mb-1'}>
        {line.trim() === '' ? '\u00A0' : parseInlineMarkdown(line)}
      </div>
    );
  };

  // Parse inline markdown (bold, italic, code, links)
  const parseInlineMarkdown = (text: string): React.ReactNode => {
    // Combined regex for all inline elements
    const inlineRegex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(`[^`]+`)|(\[([^\]]+)\]\(([^)]+)\))/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[1]) {
        // Bold text
        const boldText = match[1].slice(2, -2);
        parts.push(<strong key={match.index} className="font-semibold">{boldText}</strong>);
      } else if (match[2]) {
        // Italic text with *
        const italicText = match[2].slice(1, -1);
        parts.push(<em key={match.index} className="italic">{italicText}</em>);
      } else if (match[3]) {
        // Italic text with _
        const italicText = match[3].slice(1, -1);
        parts.push(<em key={match.index} className="italic">{italicText}</em>);
      } else if (match[4]) {
        // Inline code
        const codeText = match[4].slice(1, -1);
        parts.push(
          <code key={match.index} className="px-1 py-0.5 bg-gray-700 rounded text-sm font-mono">
            {codeText}
          </code>
        );
      } else if (match[5]) {
        // Links
        const linkText = match[6];
        const linkUrl = match[7];
        parts.push(
          <a key={match.index} href={linkUrl} target="_blank" rel="noopener noreferrer"
             className="text-blue-400 hover:text-blue-300 underline">
            {linkText}
          </a>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Handle code blocks
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        // End of code block
        inCodeBlock = false;
        elements.push(
          <pre key={`code-${index}`} className="bg-gray-800 rounded p-3 overflow-x-auto mb-2 mt-2">
            <code className={`language-${codeBlockLang || 'plaintext'}`}>
              {codeBlockContent.join('\n')}
            </code>
          </pre>
        );
        codeBlockContent = [];
        codeBlockLang = '';
      }
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    } else {
      const element = parseMarkdownLine(line, `line-${index}`);
      if (element !== null) {
        elements.push(element);
      }
    }
  });

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="code-unclosed" className="bg-gray-800 rounded p-3 overflow-x-auto mb-2 mt-2">
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    );
  }

  return <div className="markdown-content">{elements}</div>;
}

function ChatMessage({
  message,
  mcpToolExecuting,
  onAnimateImage,
  onEditImage,
  onImageOptionSelect,
  onVideoOptionSelect,
  onMultiImageOptionSelect,
  onFollowUpClick,
  onReverseEngineeringAction,
  onGenerateVideo
}: ChatMessageProps) {
  const isUser = message.role === "user"
  const attachments = message.experimental_attachments
  const [selectedFile, setSelectedFile] = useState<MessageAttachment | null>(null)
  const [focusedImage, setFocusedImage] = useState<MessageAttachment | null>(null)
  const [upscalingImage, setUpscalingImage] = useState<MessageAttachment | null>(null)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [showOptionsForAttachment, setShowOptionsForAttachment] = useState<string | null>(null)
  const [clickedImageRect, setClickedImageRect] = useState<DOMRect | null>(null)
  const imageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [selectedAttachment, setSelectedAttachment] = useState<MessageAttachment | null>(null)

  // Extract prompt information from message content
  const extractPromptFromMessage = (attachment: MessageAttachment): string | undefined => {
    if (!attachment.contentType?.startsWith('image/')) return undefined

    // Check if this is a reverse engineering result
    if (hasReverseEngineeringContent(message.content)) {
      const prompts = extractReverseEngineeringPrompts(message.content)
      if (prompts.length > 0) {
        return prompts[0].prompt
      }
    }

    // Check for image generation prompts in the message content
    const imageGenMatch = message.content.match(/Generated image.*?["']([^"']+)["']/i)
    if (imageGenMatch) {
      return imageGenMatch[1]
    }

    // Check for common prompt patterns
    const promptMatch = message.content.match(/(?:prompt|description|caption):\s*["']?([^"'\n]+)["']?/i)
    if (promptMatch) {
      return promptMatch[1]
    }

    return undefined
  }

  // Extract video generation data from message
  const videoData = useMemo(() => {
    if (!isUser && message.content) {
      const videoMatch = message.content.match(/\[VIDEO_GENERATION_STARTED\]([\s\S]*?)\[\/VIDEO_GENERATION_STARTED\]/)
      if (videoMatch) {
        try {
          return JSON.parse(videoMatch[1])
        } catch (e) {
          console.error('Failed to parse video generation data:', e)
        }
      }
    }
    return null
  }, [message, isUser])

  // Extract image options from message
  const imageOptions = useMemo(() => {
    if (!isUser && message.content) {
      console.log('[ChatMessage] Checking for IMAGE_OPTIONS in message:', message.id)
      const optionsMatch = message.content.match(/\[IMAGE_OPTIONS\]([\s\S]*?)\[\/IMAGE_OPTIONS\]/)
      if (optionsMatch) {
        console.log('[ChatMessage] Found IMAGE_OPTIONS marker!')
        try {
          const parsed = JSON.parse(optionsMatch[1])
          console.log('[ChatMessage] Successfully parsed image options:', parsed)
          return parsed
        } catch (e) {
          console.error('Failed to parse image options:', e)
        }
      }
    }
    return null
  }, [message, isUser])

  // Extract video options from message
  const videoOptions = useMemo(() => {
    if (!isUser && message.content) {
      console.log('[ChatMessage] Checking for VIDEO_OPTIONS in message:', message.id)
      const optionsMatch = message.content.match(/\[VIDEO_OPTIONS\]([\s\S]*?)\[\/VIDEO_OPTIONS\]/)
      if (optionsMatch) {
        console.log('[ChatMessage] Found VIDEO_OPTIONS marker!')
        try {
          const parsed = JSON.parse(optionsMatch[1])
          console.log('[ChatMessage] Successfully parsed video options:', parsed)
          return parsed
        } catch (e) {
          console.error('Failed to parse video options:', e)
        }
      }
    }
    return null
  }, [message, isUser])

  // Extract search metadata from message
  const searchMetadata = useMemo(() => {
    if (!isUser && message.content) {
      // First try the new WEB_SEARCH_COMPLETED format
      const webSearchMatch = message.content.match(/\[WEB_SEARCH_COMPLETED\]([\s\S]*?)\[\/WEB_SEARCH_COMPLETED\]/)
      if (webSearchMatch) {
        try {
          let jsonContent = webSearchMatch[1]

          // Handle potential double-escaping from SSE stream
          // Check if the content contains escaped quotes (after trimming whitespace)
          const trimmedContent = jsonContent.trim()
          if (trimmedContent.includes('\\"')) {
            console.log('[ChatMessage] Detected double-escaped JSON, unescaping...')
            jsonContent = jsonContent
              .replace(/\\"/g, '"')     // Unescape quotes
              .replace(/\\n/g, '\n')    // Unescape newlines
              .replace(/\\t/g, '\t')    // Unescape tabs
              .replace(/\\\\/g, '\\')   // Unescape backslashes (do this last)
              .trim()  // Trim after unescaping to remove leading/trailing whitespace
          } else {
            // Clean up any leading/trailing whitespace
            jsonContent = jsonContent.trim()
          }

          const parsed = JSON.parse(jsonContent)
          console.log('[ChatMessage] Parsed WEB_SEARCH_COMPLETED metadata:', parsed)
          // Transform the data to match expected format
          return {
            hasSearchResults: parsed.hasSearch && parsed.searchResults?.length > 0,
            searchResults: parsed.searchResults || [],
            images: parsed.images || [],
            followUpQuestions: parsed.relatedQuestions || [],
            citations: parsed.citations || [],
            hasError: parsed.hasError,
            error: parsed.error
          }
        } catch (e) {
          console.error('Failed to parse WEB_SEARCH_COMPLETED metadata:', e)
          console.error('Raw content:', webSearchMatch[1].substring(0, 200) + '...')
        }
      }

      // Fallback to legacy SEARCH_METADATA format
      const metadataMatch = message.content.match(/\[SEARCH_METADATA\]([\s\S]*?)\[\/SEARCH_METADATA\]/)
      if (metadataMatch) {
        try {
          return JSON.parse(metadataMatch[1])
        } catch (e) {
          console.error('Failed to parse search metadata:', e)
        }
      }
    }
    return null
  }, [message, isUser])

  // Extract deep research metadata from message
  const deepResearchMetadata = useMemo(() => {
    if (!isUser && message.content) {
      const metadataMatch = message.content.match(/\[DEEP_RESEARCH_METADATA\]([\s\S]*?)\[\/DEEP_RESEARCH_METADATA\]/)
      if (metadataMatch) {
        try {
          return JSON.parse(metadataMatch[1])
        } catch (e) {
          console.error('Failed to parse deep research metadata:', e)
        }
      }
    }
    return null
  }, [message, isUser])

  // Check if message indicates deep research is in progress
  const isDeepResearchInProgress = useMemo(() => {
    if (!isUser && message.content) {
      return message.content.includes('[DEEP_RESEARCH_STARTED]')
    }
    return false
  }, [message, isUser])

  // Check if message contains an agent plan
  const planData = useMemo(() => {
    if (message.agentPlan) {
      return {
        tasks: message.agentPlan.tasks,
        cleanContent: message.content,
        onTaskUpdate: message.agentPlan.onTaskUpdate,
        onSubtaskUpdate: message.agentPlan.onSubtaskUpdate
      }
    }

    // Try to extract plan from content
    if (!isUser && message.content) {
      const extracted = extractAgentPlan(message.content)
      if (extracted) {
        return {
          tasks: extracted.tasks,
          cleanContent: extracted.cleanContent,
          onTaskUpdate: undefined,
          onSubtaskUpdate: undefined
        }
      }
    }

    return null
  }, [message, isUser])


  const toggleToolExpansion = (toolId: string) => {
    const newExpanded = new Set(expandedTools)
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId)
    } else {
      newExpanded.add(toolId)
    }
    setExpandedTools(newExpanded)
  }

  return (
    <>
      <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[95%] rounded-xl px-3 py-2 sm:px-4 sm:py-3",
            isUser ? "bg-[#3C3C3C] text-white" : "bg-[#2B2B2B] text-white",
            "sm:max-w-[85%] md:max-w-[80%] lg:max-w-[75%]",
            "overflow-x-auto"
          )}
        >
          {attachments && attachments.length > 0 && (
            <div className="mb-2">
              {/* Separate videos, images, and other attachments */}
              {(() => {
                if (!attachments || attachments.length === 0) {
                  return null
                }

                const videos = attachments.filter(a => a.contentType?.startsWith('video/'))
                const images = attachments.filter(a => a.contentType?.startsWith('image/'))
                const otherAttachments = attachments.filter(a =>
                  !a.contentType?.startsWith('video/') &&
                  !a.contentType?.startsWith('image/')
                )

                return (
                  <>
                    {/* Display videos inline with larger thumbnails */}
                    {videos.length > 0 && (
                      <div className="mb-2 grid grid-cols-1 gap-2">
                        {videos.map((attachment) => {
                          const key = `${message.id}-${attachment.name}`
                          return (
                            <div
                              key={key}
                              className="relative cursor-pointer rounded-lg overflow-hidden bg-black/20 hover:bg-black/30 transition-colors group"
                              onClick={() => setSelectedFile(attachment)}
                              title="Click to play video"
                            >
                              {attachment.videoThumbnail ? (
                                <div className="relative">
                                  <img
                                    src={attachment.videoThumbnail}
                                    alt={`${attachment.name} thumbnail`}
                                    className="w-full h-auto max-h-64 object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-black/60 rounded-full p-3">
                                      <Video className="w-8 h-8 text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                  {attachment.videoDuration && (
                                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                                      {formatVideoDuration(attachment.videoDuration)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-40 bg-black/30 flex items-center justify-center">
                                  <Video className="w-12 h-12 text-gray-400" />
                                </div>
                              )}

                              {/* Analyze button overlay for videos */}
                              {onMultiImageOptionSelect && (
                                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 px-3 bg-black/60 hover:bg-black/80 text-white text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onMultiImageOptionSelect('analyze', attachment)
                                    }}
                                  >
                                    <span className="mr-1">🔍</span>
                                    Analyze
                                  </Button>
                                </div>
                              )}

                              <div className="p-2 text-xs text-gray-400">
                                {attachment.name}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Display images inline with larger previews */}
                    {images.length > 0 && (
                      <div className="mb-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {images.map((attachment) => {
                          const key = `${message.id}-${attachment.name}`
                          const hasValidUrl = attachment.url && attachment.url !== '';

                          return (
                            <div key={key} className="flex flex-col">
                              <div
                                ref={(el) => { imageRefs.current[key] = el }}
                                className="relative cursor-pointer rounded-lg overflow-hidden bg-black/20 hover:bg-black/30 transition-colors group"
                                onClick={() => {
                                  // Click on image opens focus modal
                                  setFocusedImage(attachment)
                                }}
                                title={`${attachment.name}\nClick to view full size`}
                              >
                                {hasValidUrl && !attachment.error ? (
                                  <>
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      className="w-full h-auto max-h-64 object-cover"
                                      onError={(e) => {
                                        console.error('Image failed to load:', attachment.url);
                                        // Replace with placeholder on error
                                        const target = e.target as HTMLImageElement;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          target.style.display = 'none';
                                          const placeholder = document.createElement('div');
                                          placeholder.className = 'w-full h-40 bg-black/30 flex flex-col items-center justify-center p-4';
                                          placeholder.innerHTML = `
                                            <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                            </svg>
                                            <div class="text-xs text-gray-400 text-center">
                                              ${attachment.error || 'Image could not be loaded'}
                                            </div>
                                          `;
                                          parent.appendChild(placeholder);
                                        }
                                      }}
                                    />
                                    {/* Options button overlay */}
                                    {onMultiImageOptionSelect && (
                                      <button
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation() // Prevent opening preview modal
                                          const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                                          if (rect) {
                                            setClickedImageRect(rect)
                                            setSelectedAttachment(attachment)
                                            const attachmentKey = `${message.id}-${attachment.name}`
                                            setShowOptionsForAttachment(attachmentKey)
                                          }
                                        }}
                                        title="More options"
                                      >
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <div className="w-full h-40 bg-black/30 flex flex-col items-center justify-center p-4">
                                    <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                                    <div className="text-xs text-gray-400 text-center">
                                      {attachment.error || 'Image not available'}
                                    </div>
                                  </div>
                                )}
                                <div className="p-2 text-xs text-gray-400">
                                  {attachment.name}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Display other attachments (non-video, non-image) */}
                    {otherAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {otherAttachments.map((attachment) => {
                          const fileType = attachment.contentType || ''
                          const key = `${message.id}-${attachment.name}`
                          const fileExtension = getFileExtension(attachment.name)

                          return (
                            <div key={key} className="flex flex-col">
                              <div
                                className="file-attachment cursor-pointer hover:bg-black/40 transition-colors"
                                onClick={() => setSelectedFile(attachment)}
                                title={`${attachment.name}\nClick to preview`}
                              >
                                {fileType.startsWith("audio/") ? (
                                  <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center flex-shrink-0">
                                    <FileAudio className="w-5 h-5 text-gray-400" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center flex-shrink-0">
                                    <div className="text-xs font-bold text-gray-400">
                                      {fileExtension.toUpperCase()}
                                    </div>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-xs font-medium truncate-filename">
                                    {attachment.name}
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-gray-400">
                                    <span className="uppercase">{fileExtension}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
          <div className="text-sm whitespace-pre-wrap">
            {(() => {
              // Use clean content if we have plan, otherwise use original content
              let contentToDisplay = message.content
              if (planData) {
                contentToDisplay = planData.cleanContent
              }

              if (contentToDisplay && contentToDisplay.trim()) {
                // Filter out internal API key protocol messages, video generation markers, and image options
                const content = contentToDisplay
                  .replace(/REQUEST_API_KEY:\{[^}]+\}/g, '')
                  .replace(/API_KEY_PROVIDED:\{[^}]+\}/g, '')
                  .replace(/\[VIDEO_GENERATION_STARTED\][\s\S]*?\[\/VIDEO_GENERATION_STARTED\]/g, '')
                  .replace(/\[IMAGE_GENERATION_COMPLETED\][\s\S]*?\[\/IMAGE_GENERATION_COMPLETED\]/g, '')
                  .replace(/\[IMAGE_EDITING_COMPLETED\][\s\S]*?\[\/IMAGE_EDITING_COMPLETED\]/g, '')
                  .replace(/\[IMAGE_OPTIONS\][\s\S]*?\[\/IMAGE_OPTIONS\]/g, '')
                  .replace(/\[VIDEO_OPTIONS\][\s\S]*?\[\/VIDEO_OPTIONS\]/g, '')
                  .replace(/\[TTS_GENERATION_STARTED\][\s\S]*?\[\/TTS_GENERATION_STARTED\]/g, '')
                  .replace(/\[SEARCH_METADATA\][\s\S]*?\[\/SEARCH_METADATA\]/g, '')
                  .replace(/\[WEB_SEARCH_COMPLETED\][\s\S]*?\[\/WEB_SEARCH_COMPLETED\]/g, '')
                  .replace(/\[SEARCHING_WEB\]/g, '')
                  .replace(/\[DEEP_RESEARCH_STARTED\]/g, '')
                  .replace(/\[DEEP_RESEARCH_METADATA\][\s\S]*?\[\/DEEP_RESEARCH_METADATA\]/g, '')
                  .trim()

                // If we have search metadata, use the SearchResultsDisplay component
                if (searchMetadata?.hasSearchResults) {
                  return (
                    <SearchResultsDisplay
                      content={content}
                      searchResults={searchMetadata.searchResults}
                      images={searchMetadata.images}
                      followUpQuestions={searchMetadata.followUpQuestions}
                      onFollowUpClick={onFollowUpClick}
                    />
                  )
                }

                // Check if content has reverse engineering prompts
                if (hasReverseEngineeringContent(content)) {
                  const prompts = extractReverseEngineeringPrompts(content)
                  const metadata = extractReverseEngineeringMetadata(content)

                  // Get image URI from metadata or attachments
                  const imageUri = metadata?.imageUri || message.experimental_attachments?.[0]?.url

                  // Check if this reverse engineering was for a video
                  const hasVideoAttachment = message.experimental_attachments?.some(att =>
                    att.contentType?.startsWith('video/')
                  )

                  // Remove prompt markers and metadata from content for display
                  let displayContent = content
                  prompts.forEach(() => {
                    displayContent = displayContent.replace(/\[PROMPT START\][\s\S]*?\[PROMPT END\]/, '')
                  })
                  displayContent = displayContent.replace(/\[RE_METADATA\][\s\S]*?\[\/RE_METADATA\]/, '')

                  return (
                    <>
                      {displayContent && parseSimpleMarkdown(displayContent)}
                      {prompts.map((prompt, index) => (
                        <CopyablePrompt
                          key={index}
                          prompt={prompt.prompt}
                          title={prompt.title}
                          className="mt-3"
                          imageUri={imageUri}
                          showFollowUpActions={true}
                          onFollowUpAction={onReverseEngineeringAction}
                          showVideoGeneration={hasVideoAttachment}
                          onGenerateVideo={onGenerateVideo}
                        />
                      ))}
                    </>
                  )
                }

                // Otherwise, use the regular markdown parser
                return content && parseSimpleMarkdown(content)
              }
              return null
            })()}
          </div>

          {/* Display Image Options if available */}
          {imageOptions && onImageOptionSelect && (
            <div className="mt-3 w-full">
              <ImageOptionsCard
                options={imageOptions.options}
                imageUri={imageOptions.fileUri}
                onSelect={(optionId) => onImageOptionSelect(optionId, imageOptions.fileUri)}
              />
            </div>
          )}

          {/* Display Video Options if available */}
          {videoOptions && onVideoOptionSelect && (
            <div className="mt-3 w-full">
              <VideoOptionsCard
                options={videoOptions.options}
                videoUri={videoOptions.fileUri}
                onSelect={(optionId) => onVideoOptionSelect(optionId, videoOptions.fileUri)}
              />
            </div>
          )}

          {/* Display Video Generation Progress if available */}
          {videoData && (
            <div className="mt-3 w-full">
              <VideoGenerationProgress
                videoId={videoData.id}
                prompt={videoData.prompt}
              />
            </div>
          )}

          {/* Display Deep Research Progress if available */}
          {(isDeepResearchInProgress || deepResearchMetadata) && deepResearchMetadata && (
            <div className="mt-3 w-full">
              <DeepResearchProgress
                phase={deepResearchMetadata.researchPhase}
                progress={deepResearchMetadata.progress}
                topic={deepResearchMetadata.topic}
                depth={deepResearchMetadata.depth}
              />
            </div>
          )}

          {/* Display Agent Plan if available */}
          {planData && (
            <div className="mt-3 w-full overflow-x-auto">
              <AgentPlan
                tasks={planData.tasks}
                onTaskUpdate={planData.onTaskUpdate}
                onSubtaskUpdate={planData.onSubtaskUpdate}
                compact={true}
                className="max-w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Render MCP tool calls below the message */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className={cn(
          "mt-2 w-full overflow-hidden",
          isUser ? "pr-4 max-w-[85%] ml-auto" : "pl-4 max-w-[85%]"
        )}>
          <AnimatePresence mode="wait">
            {/* Show MCP tool animation for executing tools */}
            {message.toolCalls
              .filter(tc => tc.status === 'executing')
              .map((toolCall) => (
                <MCPToolAnimation
                  key={toolCall.id}
                  tool={toolCall.tool}
                  server={toolCall.server}
                />
              ))
            }

            {/* Show MCP tool results for completed tools */}
            {message.toolCalls
              .filter(tc => tc.status === 'completed' || tc.status === 'failed')
              .map((toolCall) => (
                <MCPToolResult
                  key={toolCall.id}
                  tool={toolCall.tool}
                  server={toolCall.server}
                  result={toolCall.result}
                  status={toolCall.status}
                  error={toolCall.error}
                  isExpanded={expandedTools.has(toolCall.id)}
                  onToggleExpand={() => toggleToolExpansion(toolCall.id)}
                  timestamp={toolCall.timestamp}
                  duration={toolCall.duration}
                />
              ))
            }
          </AnimatePresence>
        </div>
      )}

      {selectedFile && !selectedFile.contentType?.startsWith('image/') && (
        <FilePreviewModal
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
          file={{
            ...selectedFile,
            prompt: extractPromptFromMessage(selectedFile)
          }}
          onAnimate={onAnimateImage}
          onEdit={onEditImage}
          onAnalyze={selectedFile.contentType?.startsWith('image/') && onMultiImageOptionSelect ? 
            (fileName, contentType) => onMultiImageOptionSelect('analyze', { ...selectedFile, name: fileName, contentType }) : 
            undefined
          }
          availableOptions={selectedFile.contentType?.startsWith('image/') ? ['analyze', 'edit', 'animate'] : ['analyze']}
        />
      )}

      {focusedImage && focusedImage.contentType?.startsWith('image/') && (
        <ImageFocusModal
          isOpen={!!focusedImage}
          onClose={() => setFocusedImage(null)}
          image={{
            id: focusedImage.name,
            url: focusedImage.url || '',
            prompt: extractPromptFromMessage(focusedImage) || focusedImage.name,
            quality: (focusedImage as any).metadata?.quality || 'standard' as const,
            timestamp: (focusedImage as any).metadata?.timestamp ? new Date((focusedImage as any).metadata.timestamp) : new Date(),
            model: (focusedImage as any).metadata?.model || 'DALL-E',
            size: (focusedImage as any).metadata?.size || '1024x1024',
            isUpscaled: (focusedImage as any).metadata?.isUpscaled || false
          }}
          onEdit={onEditImage ? () => {
            if (focusedImage.url) {
              onEditImage(focusedImage.url, focusedImage.name)
            }
          } : undefined}
          onAnimate={onAnimateImage ? () => {
            if (focusedImage.url) {
              onAnimateImage(focusedImage.url, focusedImage.name)
            }
          } : undefined}
          onUpscale={() => {
            setFocusedImage(null)
            setUpscalingImage(focusedImage)
          }}
          onDelete={onMultiImageOptionSelect ? (imageId) => {
            // Delete functionality can be implemented through onMultiImageOptionSelect
            console.log('Delete image:', imageId)
          } : undefined}
        />
      )}

      {upscalingImage && upscalingImage.url && (
        <ImageUpscaleModal
          image={{
            id: upscalingImage.name,
            url: upscalingImage.url,
            prompt: extractPromptFromMessage(upscalingImage) || upscalingImage.name,
            timestamp: new Date(),
            quality: 'standard' as const,
            model: 'Unknown',
            size: 'Unknown',
            isGenerating: false,
            isUploaded: false
          }}
          isOpen={!!upscalingImage}
          onClose={() => setUpscalingImage(null)}
          onUpscaleComplete={(upscaledImage) => {
            // Handle upscale complete
            console.log('Upscaled image:', upscaledImage)
            setUpscalingImage(null)
          }}
        />
      )}

      {/* Image Options Popup */}
      <ImageOptionsPopup
        isOpen={!!showOptionsForAttachment && !!selectedAttachment}
        onClose={() => {
          setShowOptionsForAttachment(null)
          setClickedImageRect(null)
          setSelectedAttachment(null)
        }}
        onOptionSelect={(option) => {
          if (selectedAttachment && onMultiImageOptionSelect) {
            onMultiImageOptionSelect(option, selectedAttachment)
          }
        }}
        showMultiEdit={
          attachments ?
          attachments.filter(a => a.contentType?.startsWith('image/')).length >= 2 :
          false
        }
        targetRef={showOptionsForAttachment ?
          { current: imageRefs.current[showOptionsForAttachment] } :
          undefined
        }
        imageRect={clickedImageRect || undefined}
      />
    </>
  )
}

export default React.memo(ChatMessage)
