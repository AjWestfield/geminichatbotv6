"use client"

import * as React from "react"
import { Slider } from "./slider"

interface AudioSliderProps {
  value: number[]
  max: number
  step?: number
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
  className?: string
  disabled?: boolean
}

export function AudioSlider({
  value,
  max,
  step = 0.1,
  onValueChange,
  onValueCommit,
  className,
  disabled
}: AudioSliderProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(value)
  const startValueRef = React.useRef(value[0])

  React.useEffect(() => {
    if (!isDragging) {
      setLocalValue(value)
    }
  }, [value, isDragging])

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    setIsDragging(true)
    startValueRef.current = localValue[0]

    // Capture pointer for smooth dragging
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }, [localValue])

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)

      // Release pointer capture
      const target = e.currentTarget as HTMLElement
      target.releasePointerCapture(e.pointerId)

      // Commit the final value
      if (onValueCommit) {
        onValueCommit(localValue)
      }
    }
  }, [isDragging, localValue, onValueCommit])

  const handleValueChange = React.useCallback((newValue: number[]) => {
    setLocalValue(newValue)

    // Only call onValueChange for visual updates
    if (onValueChange) {
      onValueChange(newValue)
    }
  }, [onValueChange])

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="touch-none"
    >
      <Slider
        value={localValue}
        max={max}
        step={step}
        onValueChange={handleValueChange}
        className={className}
        disabled={disabled}
      />
    </div>
  )
}
