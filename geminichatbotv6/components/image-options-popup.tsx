import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ImageOptionsPopupProps {
  isOpen: boolean
  onClose: () => void
  onOptionSelect: (option: 'analyze' | 'edit' | 'animate' | 'multi-edit') => void
  showMultiEdit?: boolean
  targetRef?: React.RefObject<HTMLElement>
  imageRect?: DOMRect
}

export function ImageOptionsPopup({ 
  isOpen, 
  onClose, 
  onOptionSelect, 
  showMultiEdit = false,
  targetRef,
  imageRect
}: ImageOptionsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 480)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Calculate position relative to clicked image
  useEffect(() => {
    if (isOpen && imageRect && !isMobile) {
      const calculatePosition = () => {
        const popupWidth = showMultiEdit ? 160 : 120 // Compact width
        const popupHeight = 36 // Compact height
        const offset = 4 // Minimal offset from image
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const scrollY = window.scrollY
        const scrollX = window.scrollX
        
        // Position at top-right corner of image by default
        let left = imageRect.right + scrollX - popupWidth - offset
        let top = imageRect.top + scrollY + offset
        
        // If too close to right edge, align to left side of image
        if (imageRect.right > viewportWidth - popupWidth - 20) {
          left = imageRect.left + scrollX + offset
        }
        
        // If too close to top, position below image
        if (imageRect.top < 50) {
          top = imageRect.bottom + scrollY - popupHeight - offset
        }
        
        // Ensure stays within viewport
        left = Math.max(scrollX + offset, Math.min(left, viewportWidth + scrollX - popupWidth - offset))
        top = Math.max(scrollY + offset, Math.min(top, viewportHeight + scrollY - popupHeight - offset))
        
        setPosition({ top, left })
      }
      
      calculatePosition()
      
      // Recalculate on scroll
      const handleScroll = () => calculatePosition()
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [isOpen, imageRect, isMobile, showMultiEdit])

  // Handle click outside
  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
          // Also check if click is on the target image
          if (targetRef?.current && !targetRef.current.contains(event.target as Node)) {
            onClose()
          }
        }
      }

      // Handle keyboard navigation
      const handleKeyDown = (event: KeyboardEvent) => {
        const optionCount = showMultiEdit ? 4 : 3
        
        switch (event.key) {
          case 'Escape':
            onClose()
            break
          case 'ArrowLeft':
            event.preventDefault()
            setSelectedIndex(prev => (prev - 1 + optionCount) % optionCount)
            break
          case 'ArrowRight':
            event.preventDefault()
            setSelectedIndex(prev => (prev + 1) % optionCount)
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            const options = ['analyze', 'edit', 'animate']
            if (showMultiEdit) options.push('multi-edit')
            handleOptionClick(options[selectedIndex] as any)
            break
        }
      }

      // Add listeners after a small delay to avoid immediate close
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
      }, 100)

      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, onClose, targetRef, showMultiEdit, selectedIndex])

  const handleOptionClick = (option: 'analyze' | 'edit' | 'animate' | 'multi-edit') => {
    onOptionSelect(option)
    onClose()
  }

  const options = [
    { id: 'analyze' as const, label: 'Analyze', icon: '🔍', tooltip: 'Analyze content' },
    { id: 'edit' as const, label: 'Edit', icon: '✏️', tooltip: 'Edit with AI' },
    { id: 'animate' as const, label: 'Animate', icon: '🎬', tooltip: 'Create video' },
  ]

  if (showMultiEdit) {
    options.push({ 
      id: 'multi-edit' as const, 
      label: 'Multi Edit', 
      icon: '🎨', 
      tooltip: 'Edit multiple' 
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle backdrop - only on mobile */}
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/10 z-40"
              onClick={onClose}
            />
          )}

          {/* Compact Toolbar */}
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className={cn(
              "z-50",
              isMobile ? (
                "fixed bottom-4 left-1/2 -translate-x-1/2"
              ) : (
                "fixed"
              )
            )}
            style={!isMobile ? position : undefined}
          >
            <div className={cn(
              "flex items-center gap-0.5 p-1",
              "bg-[#1e1e1e]/90 backdrop-blur-md",
              "border border-[#333333]/50",
              "rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            )}>
              <TooltipProvider delayDuration={300}>
                {options.map((option, index) => (
                  <Tooltip key={option.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleOptionClick(option.id)}
                        className={cn(
                          "relative group",
                          "w-8 h-8 rounded-full",
                          "flex items-center justify-center",
                          "bg-transparent hover:bg-[#333333]/60",
                          "transition-colors duration-150",
                          option.id === 'multi-edit' && "hover:bg-purple-600/20",
                          index > 0 && !isMobile && "ml-0.5",
                          selectedIndex === index && "bg-[#333333]/60 ring-1 ring-[#555555]"
                        )}
                      >
                        <span className={cn(
                          "text-base leading-none",
                          "transition-transform duration-150",
                          "group-hover:scale-110"
                        )}>
                          {option.icon}
                        </span>
                      </motion.button>
                    </TooltipTrigger>
                    {!isMobile && (
                      <TooltipContent 
                        side="top" 
                        className="bg-[#1e1e1e] border-[#333333] text-xs px-2 py-1"
                      >
                        <p>{option.tooltip}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}