import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EnhancedTextarea } from "@/components/ui/enhanced-textarea"

interface ImageActionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (prompt: string) => void
  action: 'edit' | 'animate'
  imageName: string
}

export function ImageActionDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  action,
  imageName 
}: ImageActionDialogProps) {
  const [prompt, setPrompt] = useState('')
  
  const placeholders = {
    edit: "e.g., Change the background to a sunset, add a hat to the person, remove the background objects, make it nighttime...",
    animate: "e.g., Make the person wave and smile, zoom into the face slowly, pan across the scene, add gentle wind movement..."
  }
  
  const titles = {
    edit: "What would you like to change?",
    animate: "How should the image move?"
  }
  
  const descriptions = {
    edit: `Describe the changes you want. A new image will be generated based on your current image with these modifications.`,
    animate: `Describe how you want "${imageName}" to animate. Include movements, transitions, and any specific actions.`
  }
  
  const handleConfirm = () => {
    if (prompt.trim()) {
      onConfirm(prompt.trim())
      setPrompt('') // Clear for next use
      onClose()
    }
  }
  
  // Handle Enter key to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && prompt.trim()) {
      handleConfirm()
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setPrompt('') // Clear on close
        onClose()
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
          <DialogDescription>
            {descriptions[action]}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <EnhancedTextarea
            placeholder={placeholders[action]}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="resize-none"
            context={action === 'edit' ? 'image-edit' : 'video'}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Press Ctrl+Enter to submit
          </p>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setPrompt('')
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!prompt.trim()}
          >
            {action === 'edit' ? 'Start Editing' : 'Create Video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}