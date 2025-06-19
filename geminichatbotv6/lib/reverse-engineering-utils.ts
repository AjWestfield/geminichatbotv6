/**
 * Utility functions for reverse engineering analysis
 */

export interface ExtractedPrompt {
  prompt: string
  title?: string
  index: number
}

export interface FollowUpAction {
  id: 'generate-image' | 'animate-image' | 'edit-image' | 'generate-variations'
  label: string
  icon: string
  description: string
  disabled?: boolean
}

export interface ReverseEngineeringMetadata {
  imageUri?: string
  hasImage: boolean
  model?: string
  videoModel?: string
}

/**
 * Extract prompts from AI response content
 * Looks for prompts wrapped in [PROMPT START] and [PROMPT END] markers
 */
export function extractReverseEngineeringPrompts(content: string): ExtractedPrompt[] {
  const promptRegex = /\[PROMPT START\]([\s\S]*?)\[PROMPT END\]/g
  const prompts: ExtractedPrompt[] = []
  let match
  let index = 0

  while ((match = promptRegex.exec(content)) !== null) {
    prompts.push({
      prompt: match[1].trim(),
      title: `Recreatable Prompt ${index + 1}`,
      index
    })
    index++
  }

  return prompts
}

/**
 * Replace prompt markers with placeholder divs for React rendering
 */
export function replacePromptMarkers(content: string): string {
  let processedContent = content
  let index = 0

  // Replace each prompt section with a placeholder
  processedContent = processedContent.replace(
    /\[PROMPT START\][\s\S]*?\[PROMPT END\]/g,
    () => {
      const placeholder = `<div data-prompt-placeholder="${index}"></div>`
      index++
      return placeholder
    }
  )

  return processedContent
}

/**
 * Check if content contains reverse engineering analysis
 */
export function hasReverseEngineeringContent(content: string): boolean {
  return content.includes('[PROMPT START]') && content.includes('[PROMPT END]')
}

/**
 * Extract metadata from reverse engineering content
 */
export function extractReverseEngineeringMetadata(content: string): ReverseEngineeringMetadata | null {
  const metadataRegex = /\[RE_METADATA\]([\s\S]*?)\[\/RE_METADATA\]/
  const match = content.match(metadataRegex)
  
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch (e) {
      console.error('Failed to parse RE metadata:', e)
    }
  }
  
  return null
}

/**
 * Generate analysis prompt with reverse engineering instructions
 */
export function createAnalysisPrompt(
  imageFiles: File[],
  videoFiles: File[],
  audioFiles: File[],
  documentFiles: File[],
  includeReverseEngineering: boolean = true
): string {
  let analysisPrompt = "Please provide a detailed analysis of the uploaded files:\n\n"

  if (imageFiles.length > 0) {
    analysisPrompt += `Images (${imageFiles.length}): Analyze the visual content, composition, subjects, colors, style, and any text or objects visible.\n`
    
    if (includeReverseEngineering) {
      analysisPrompt += `\n**Reverse Engineering Analysis for Images:**\n`
      analysisPrompt += `For each image, provide an extremely detailed analysis:\n\n`
      analysisPrompt += `1. **AI Model Detection**: Identify the likely AI model/tool used:\n`
      analysisPrompt += `   - Look for telltale signs: rendering style, artifact patterns, resolution characteristics\n`
      analysisPrompt += `   - Common models: Midjourney (v4/v5/v6), DALL-E 3, Stable Diffusion (1.5/XL/3), Flux, Ideogram, Adobe Firefly\n`
      analysisPrompt += `   - Explain WHY you think it's this specific model\n\n`
      analysisPrompt += `2. **Technical Analysis**:\n`
      analysisPrompt += `   - Art style (photorealistic, digital art, anime, illustration, 3D render, etc.)\n`
      analysisPrompt += `   - Quality indicators (resolution, detail level, coherence)\n`
      analysisPrompt += `   - Lighting and composition techniques\n`
      analysisPrompt += `   - Color grading and post-processing effects\n\n`
      analysisPrompt += `3. **Prompt Engineering Reverse Analysis**:\n`
      analysisPrompt += `   - Break down the likely prompt structure\n`
      analysisPrompt += `   - Identify style modifiers and artistic influences\n`
      analysisPrompt += `   - Detect weight parameters or emphasis techniques\n`
      analysisPrompt += `   - Suggest negative prompts if applicable\n\n`
      analysisPrompt += `4. **Recreatable Prompt Generation**:\n`
      analysisPrompt += `   - Create a detailed prompt that would generate a similar image\n`
      analysisPrompt += `   - Include all necessary style tokens, quality modifiers, and parameters\n`
      analysisPrompt += `   - Format for the detected AI model's syntax\n\n`
      analysisPrompt += `5. **Parameters and Settings**:\n`
      analysisPrompt += `   - Aspect ratio (1:1, 16:9, 9:16, etc.)\n`
      analysisPrompt += `   - Quality/steps settings\n`
      analysisPrompt += `   - CFG scale or guidance scale\n`
      analysisPrompt += `   - Seed (if detectable from consistency)\n`
      analysisPrompt += `   - Any model-specific parameters\n\n`
      analysisPrompt += `Format each recreatable prompt in a clearly marked section:\n`
      analysisPrompt += `[PROMPT START]\n<complete prompt with all parameters and modifiers>\n[PROMPT END]\n\n`
      analysisPrompt += `Be specific and detailed. The goal is for someone to copy your prompt and generate a very similar image.\n`
    }
  }

  if (videoFiles.length > 0) {
    analysisPrompt += `\nVideos (${videoFiles.length}): Analyze the video content, duration, visual elements, transitions, and any audio components.\n`
    
    if (includeReverseEngineering) {
      analysisPrompt += `\n**Reverse Engineering Analysis for Videos:**\n`
      analysisPrompt += `For each video, provide:\n`
      analysisPrompt += `1. Likely AI video generation tool (Runway Gen-2/Gen-3, Pika Labs, Stable Video Diffusion, Kling, HeyGen, etc.)\n`
      analysisPrompt += `2. Generation technique (text-to-video, image-to-video, video-to-video)\n`
      analysisPrompt += `3. Motion characteristics and camera movements\n`
      analysisPrompt += `4. A detailed prompt that could recreate similar video content\n`
      analysisPrompt += `5. Suggested parameters (duration, fps, motion intensity, camera controls)\n\n`
      analysisPrompt += `Format video prompts as:\n`
      analysisPrompt += `[PROMPT START]\n<video generation prompt with motion and style details>\n[PROMPT END]\n\n`
    }
  }

  if (audioFiles.length > 0) {
    analysisPrompt += `\nAudio files (${audioFiles.length}): Analyze the audio content, transcribe any speech, and identify music or sound effects.\n`
  }

  if (documentFiles.length > 0) {
    analysisPrompt += `\nDocuments (${documentFiles.length}): Analyze the text content, structure, and key information.\n`
  }

  analysisPrompt += "\nProvide insights, observations, and any relevant details about each file."

  return analysisPrompt
}
