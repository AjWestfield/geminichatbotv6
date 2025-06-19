"use client"

import * as React from "react"
import { Slider } from "./slider"
import { cn } from "@/lib/utils"

interface VolumeSliderProps {
  value: number[]
  onValueChange?: (value: number[]) => void
  className?: string
  disabled?: boolean
}

export function VolumeSlider({
  value,
  onValueChange,
  className,
  disabled
}: VolumeSliderProps) {
  const handleValueChange = React.useCallback((newValue: number[]) => {
    if (onValueChange) {
      onValueChange(newValue)
    }
  }, [onValueChange])

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    // Prevent any event bubbling that might affect audio playback
    e.stopPropagation()
  }, [])

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    // Prevent focus changes
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleClick = React.useCallback((e: React.MouseEvent) => {
    // Prevent click from bubbling
    e.stopPropagation()
  }, [])

  return (
    <div
      className={cn("relative", className)}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onPointerUp={handlePointerDown}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerDown}
    >
      <Slider
        value={value}
        max={1}
        step={0.01}
        onValueChange={handleValueChange}
        disabled={disabled}
        // Prevent focus on the slider to maintain audio focus
        onFocus={(e) => {
          // Blur immediately to prevent focus issues
          e.currentTarget.blur()
        }}
      />
    </div>
  )
}
