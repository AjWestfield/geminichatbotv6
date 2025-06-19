import { Card } from "@/components/ui/card"
import { ExternalLink, Calendar, Globe, ChevronRight } from "lucide-react"
import { useState } from "react"
import { SearchImageModal } from "./search-image-modal"
import { Button } from "@/components/ui/button"
import { EnhancedTable, parseTableFromMarkdown } from "./enhanced-table"
import { getSourceLogo } from "@/lib/source-logos"

interface SearchResult {
  title: string
  url: string
  date?: string
  thumbnail?: string
  description?: string
}

interface SearchImage {
  url?: string
  image_url?: string
  title?: string
  source?: string
  origin_url?: string
  height?: number
  width?: number
}

interface SearchResultsDisplayProps {
  content: string
  searchResults?: SearchResult[]
  images?: SearchImage[]
  followUpQuestions?: string[]
  onFollowUpClick?: (question: string) => void
}

// Simple markdown parser similar to chat-message.tsx
function parseSimpleMarkdown(text: string) {
  // Split by double asterisks to handle bold text
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove asterisks and make bold
      const boldText = part.slice(2, -2)
      return <strong key={index} className="font-semibold">{boldText}</strong>
    }
    
    // Handle line breaks
    const lines = part.split('\n')
    return lines.map((line, lineIndex) => (
      <span key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    ))
  })
}

export function SearchResultsDisplay({ content, searchResults, images, followUpQuestions, onFollowUpClick }: SearchResultsDisplayProps) {
  const [selectedImage, setSelectedImage] = useState<SearchImage | null>(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  
  // Remove the sources section from content if it exists (we'll render it separately)
  const cleanContent = content.replace(/\n\n\*\*Sources:\*\*[\s\S]*$/, '').trim()
  
  // Check if content contains a table
  const tableData = parseTableFromMarkdown(cleanContent)
  const contentWithoutTable = tableData 
    ? cleanContent.replace(/\|(.+)\|[\s\S]*?\n\|[-:\s|]+\|[\s\S]*?\n((?:\|.+\|\n?)+)/, '').replace(/#+\s*Summary Table[\s\S]*?\n\n((?:\|.+\|\n?)+)/i, '').trim()
    : cleanContent
  
  const handleImageClick = (image: SearchImage) => {
    setSelectedImage(image)
    setIsImageModalOpen(true)
  }
  
  return (
    <div className="space-y-4 w-full overflow-x-auto">
      {/* Enhanced Table if present */}
      {tableData && (
        <div className="w-full overflow-x-auto">
          <EnhancedTable data={tableData} />
        </div>
      )}
      
      {/* Main content (without table) */}
      {contentWithoutTable && (
        <div className="text-xs sm:text-sm break-words">
          {parseSimpleMarkdown(contentWithoutTable)}
        </div>
      )}

      {/* Images Grid */}
      {images && images.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Related Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2">
            {images.slice(0, 6).map((image, index) => (
              <Card 
                key={index} 
                className="group cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background transition-all transform hover:scale-105"
                onClick={() => handleImageClick(image)}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={image.url || image.image_url || ''}
                    alt={image.title || `Search result ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      // Hide broken images
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                {image.title && (
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {image.title}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {searchResults && searchResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Sources</h3>
          <div className="space-y-2">
            {searchResults.map((result, index) => {
              const domain = new URL(result.url).hostname.replace('www.', '')
              // Try to find a matching image for this source
              const matchingImage = images?.find(img => 
                img.source?.includes(domain) || 
                img.origin_url?.includes(domain)
              )
              // Get source logo
              const sourceLogo = getSourceLogo(result.url)
              const displayImage = matchingImage?.url || matchingImage?.image_url || sourceLogo
              
              return (
                <Card key={index} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {displayImage ? (
                      <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted">
                        <img 
                          src={displayImage}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to numbered circle on error
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="w-16 h-16 rounded bg-primary text-primary-foreground text-lg font-medium flex items-center justify-center">${index + 1}</span>`;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <span className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        {result.title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Globe className="w-3 h-3" />
                        <span>{domain}</span>
                        {result.date && (
                          <>
                            <span>•</span>
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(result.date).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Follow-up Questions */}
      {followUpQuestions && followUpQuestions.length > 0 && onFollowUpClick && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Related Questions</h3>
          <div className="flex flex-col gap-2">
            {followUpQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-sm text-left justify-start items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors whitespace-normal h-auto py-2 px-3"
                onClick={() => onFollowUpClick(question)}
              >
                <span className="flex-1">{question}</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Image Modal */}
      <SearchImageModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false)
          setSelectedImage(null)
        }}
        image={selectedImage}
      />
    </div>
  )
}
