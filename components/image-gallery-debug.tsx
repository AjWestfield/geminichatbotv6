// Debug utility for image gallery - add this temporarily to ImageGallery component
// This helps identify and fix stuck images

export function ImageGalleryDebug({ images }: { images: GeneratedImage[] }) {
  const stuckImages = images.filter(img => img.isGenerating && img.url)
  
  if (stuckImages.length === 0) return null
  
  return (
    <div className="fixed bottom-4 right-4 bg-red-900/90 text-white p-4 rounded-lg max-w-sm z-50">
      <h3 className="font-bold mb-2">⚠️ Stuck Images Detected</h3>
      <p className="text-sm mb-3">
        {stuckImages.length} image(s) stuck in generating state with URLs available.
      </p>
      <button
        onClick={() => {
          // Force refresh the page to clear stuck state
          window.location.reload()
        }}
        className="bg-white text-red-900 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100"
      >
        Refresh to Fix
      </button>
      <div className="mt-2 text-xs opacity-75">
        This is a temporary debug tool
      </div>
    </div>
  )
}