"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ResizablePanelsProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  className?: string
}

export default function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 600,
  minLeftWidth = 360,
  maxLeftWidth = 800,
  className,
}: ResizablePanelsProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = e.clientX - containerRect.left

      // Constrain the width within min and max bounds
      const constrainedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth))

      // Ensure there's enough space for the right panel (minimum 300px)
      const maxAllowedWidth = containerRect.width - 300
      const finalWidth = Math.min(constrainedWidth, maxAllowedWidth)

      setLeftWidth(finalWidth)
    },
    [isDragging, minLeftWidth, maxLeftWidth],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} className={cn("flex h-full", className)}>
      {/* Left Panel */}
      <div style={{ width: leftWidth }} className="flex-shrink-0 h-full">
        {leftPanel}
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          "w-[1px] bg-[#333333] cursor-col-resize hover:bg-[#444444] transition-colors relative group",
          isDragging && "bg-[#555555]",
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Visual indicator */}
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-[1px] bg-[#444444] opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Expanded hover area */}
        <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 h-full min-w-0">{rightPanel}</div>
    </div>
  )
}
