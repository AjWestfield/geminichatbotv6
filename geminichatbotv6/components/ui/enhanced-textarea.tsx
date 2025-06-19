"use client"

import React, { forwardRef } from "react"
import { Textarea, TextareaProps } from "@/components/ui/textarea"
import { PromptEnhancer } from "@/components/ui/prompt-enhancer"
import { cn } from "@/lib/utils"

interface EnhancedTextareaProps extends TextareaProps {
  model?: string
  context?: "chat" | "image-edit" | "video" | "audio" | "multi-image"
  hideEnhancer?: boolean
  enhancerClassName?: string
}

export const EnhancedTextarea = forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({ 
    className, 
    value, 
    onChange, 
    model = "gemini", 
    context = "chat",
    hideEnhancer = false,
    enhancerClassName,
    disabled,
    ...props 
  }, ref) => {
    const stringValue = value?.toString() || ""

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e)
    }

    const handleEnhancerChange = (newValue: string) => {
      // Create a synthetic event
      const syntheticEvent = {
        target: {
          value: newValue
        }
      } as React.ChangeEvent<HTMLTextAreaElement>
      
      onChange?.(syntheticEvent)
    }

    return (
      <div className="space-y-2">
        <Textarea
          ref={ref}
          className={cn(
            "min-h-[100px] bg-[#1E1E1E] border-[#333333] text-white placeholder:text-gray-500",
            className
          )}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          {...props}
        />
        {!hideEnhancer && (
          <PromptEnhancer
            value={stringValue}
            onChange={handleEnhancerChange}
            model={model}
            context={context}
            disabled={disabled}
            className={enhancerClassName}
          />
        )}
      </div>
    )
  }
)

EnhancedTextarea.displayName = "EnhancedTextarea"