"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ResizableThreePanelsProps {
  leftPanel: React.ReactNode
  middlePanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftWidth?: number
  defaultRightWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  minRightWidth?: number
  maxRightWidth?: number
  className?: string
}

export default function ResizableThreePanels({
  leftPanel,
  middlePanel,
  rightPanel,
  defaultLeftWidth = 300,
  defaultRightWidth = 400,
  minLeftWidth = 240,
  maxLeftWidth = 400,
  minRightWidth = 300,
  maxRightWidth = 600,
  className,
}: ResizableThreePanelsProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [rightWidth, setRightWidth] = useState(defaultRightWidth)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Left panel resize handlers
  const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingLeft(true)
  }, [])

  const handleLeftMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingLeft || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeftWidth = e.clientX - containerRect.left

      // Constrain the width within min and max bounds
      const constrainedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth))

      // Ensure there's enough space for middle and right panels (minimum 400px combined)
      const maxAllowedWidth = containerRect.width - rightWidth - 400
      const finalWidth = Math.min(constrainedWidth, maxAllowedWidth)

      setLeftWidth(finalWidth)
    },
    [isDraggingLeft, minLeftWidth, maxLeftWidth, rightWidth],
  )

  // Right panel resize handlers
  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingRight(true)
  }, [])

  const handleRightMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRight || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newRightWidth = containerRect.right - e.clientX

      // Constrain the width within min and max bounds
      const constrainedWidth = Math.max(minRightWidth, Math.min(maxRightWidth, newRightWidth))

      // Ensure there's enough space for left and middle panels (minimum 400px combined)
      const maxAllowedWidth = containerRect.width - leftWidth - 400
      const finalWidth = Math.min(constrainedWidth, maxAllowedWidth)

      setRightWidth(finalWidth)
    },
    [isDraggingRight, minRightWidth, maxRightWidth, leftWidth],
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingLeft(false)
    setIsDraggingRight(false)
  }, [])

  useEffect(() => {
    if (isDraggingLeft || isDraggingRight) {
      const handleMove = isDraggingLeft ? handleLeftMouseMove : handleRightMouseMove
      
      document.addEventListener("mousemove", handleMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isDraggingLeft, isDraggingRight, handleLeftMouseMove, handleRightMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} className={cn("flex h-full", className)}>
      {/* Left Panel (MCP) */}
      <div style={{ width: leftWidth }} className="flex-shrink-0 h-full">
        {leftPanel}
      </div>

      {/* Left Resize Handle */}
      <div
        className={cn(
          "w-[1px] bg-[#333333] cursor-col-resize hover:bg-[#444444] transition-colors relative group",
          isDraggingLeft && "bg-[#555555]",
        )}
        onMouseDown={handleLeftMouseDown}
      >
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-[1px] bg-[#444444] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      </div>

      {/* Middle Panel (Chat) */}
      <div className="flex-1 h-full min-w-0">
        {middlePanel}
      </div>

      {/* Right Resize Handle */}
      <div
        className={cn(
          "w-[1px] bg-[#333333] cursor-col-resize hover:bg-[#444444] transition-colors relative group",
          isDraggingRight && "bg-[#555555]",
        )}
        onMouseDown={handleRightMouseDown}
      >
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-[1px] bg-[#444444] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      </div>

      {/* Right Panel (Canvas) */}
      <div style={{ width: rightWidth }} className="flex-shrink-0 h-full">
        {rightPanel}
      </div>
    </div>
  )
}