import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface InlineImageOptionsProps {
  isVisible: boolean
  onOptionSelect: (option: 'analyze' | 'analyze-reverse' | 'edit' | 'animate' | 'multi-edit') => void
  showMultiEdit?: boolean
}

export function InlineImageOptions({ isVisible, onOptionSelect, showMultiEdit = false }: InlineImageOptionsProps) {
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 px-2 bg-[#2B2B2B] hover:bg-[#333333] text-white text-sm"
                  >
                    <span className="text-base mr-1">🔍</span>
                    <span className="hidden sm:inline">Analyze</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-[#2B2B2B] border-[#444444]">
                  <DropdownMenuItem
                    onClick={() => onOptionSelect('analyze')}
                    className="cursor-pointer hover:bg-[#333333] text-white"
                  >
                    <span className="text-base mr-2">🔬</span>
                    Standard Analysis
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onOptionSelect('analyze-reverse')}
                    className="cursor-pointer hover:bg-[#333333] text-white"
                  >
                    <span className="text-base mr-2">🎯</span>
                    Reverse Engineering Analysis
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOptionSelect('edit')}
                    className="flex-1 h-8 px-2 bg-[#2B2B2B] hover:bg-[#333333] text-white text-sm"
                  >
                    <span className="text-base mr-1">✏️</span>
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit with AI</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOptionSelect('animate')}
                    className="flex-1 h-8 px-2 bg-[#2B2B2B] hover:bg-[#333333] text-white text-sm"
                  >
                    <span className="text-base mr-1">🎬</span>
                    <span className="hidden sm:inline">Animate</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create video</p>
                </TooltipContent>
              </Tooltip>

              {showMultiEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOptionSelect('multi-edit')}
                      className="flex-1 h-8 px-2 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                    >
                      <span className="text-base mr-1">🎨</span>
                      <span className="hidden sm:inline">Multi Edit</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit multiple images together</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
