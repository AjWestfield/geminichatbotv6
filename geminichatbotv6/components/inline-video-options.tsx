import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface InlineVideoOptionsProps {
  isVisible: boolean
  onOptionSelect: (option: 'analyze' | 'reverse-engineer') => void
}

export function InlineVideoOptions({ isVisible, onOptionSelect }: InlineVideoOptionsProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className="mb-3 p-1.5 bg-[#3C3C3C] border border-[#444444] rounded-md shadow-lg"
        >
          <TooltipProvider>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOptionSelect('analyze')}
                    className="flex-1 h-8 px-3 bg-[#2B2B2B] hover:bg-[#333333] text-white text-sm"
                  >
                    <span className="text-base mr-1.5">🔍</span>
                    <span>Analyze & Transcribe</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Full analysis with audio transcription</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOptionSelect('reverse-engineer')}
                    className="flex-1 h-8 px-3 bg-[#2B2B2B] hover:bg-[#333333] text-white text-sm"
                  >
                    <span className="text-base mr-1.5">🔄</span>
                    <span>Reverse Engineer</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Analyze creation techniques</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  )
}