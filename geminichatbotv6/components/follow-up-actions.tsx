"use client"

import { Button } from "@/components/ui/button"
import { Wand2, Video, Edit3, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

interface FollowUpActionsProps {
  prompt: string
  imageUri?: string
  onAction: (action: 'generate-image' | 'animate-image' | 'edit-image' | 'generate-variations', prompt: string, imageUri?: string) => void
}

export function FollowUpActions({ prompt, imageUri, onAction }: FollowUpActionsProps) {
  const actions = [
    {
      id: 'generate-image' as const,
      label: 'Generate Image',
      icon: <Wand2 className="w-4 h-4" />,
      description: 'Create image from this prompt',
      color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/20',
      disabled: !prompt
    },
    {
      id: 'animate-image' as const,
      label: 'Animate Image',
      icon: <Video className="w-4 h-4" />,
      description: 'Turn image into video',
      color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/20',
      disabled: !imageUri
    },
    {
      id: 'edit-image' as const,
      label: 'Edit Image',
      icon: <Edit3 className="w-4 h-4" />,
      description: 'Modify the image',
      color: 'bg-green-500/10 hover:bg-green-500/20 text-green-300 border-green-500/20',
      disabled: !imageUri
    },
    {
      id: 'generate-variations' as const,
      label: 'Generate Variations',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Create similar images',
      color: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border-yellow-500/20',
      disabled: !prompt
    }
  ]

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10"
    >
      <h4 className="text-sm font-medium text-gray-300 mb-3">Follow-up Actions</h4>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <motion.div
            key={action.id}
            whileHover={{ scale: action.disabled ? 1 : 1.02 }}
            whileTap={{ scale: action.disabled ? 1 : 0.98 }}
          >
            <Button
              variant="ghost"
              size="sm"
              disabled={action.disabled}
              onClick={() => onAction(action.id, prompt, imageUri)}
              className={`w-full ${action.color} justify-start gap-2 transition-all duration-200 border`}
              title={action.disabled ? `${action.label} requires ${action.id === 'animate-image' || action.id === 'edit-image' ? 'an image' : 'a prompt'}` : action.description}
            >
              {action.icon}
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
