"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const AudioVolumeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, onValueChange, ...props }, ref) => {
  // Don't pass disabled prop to allow interaction even when audio has errors
  const { disabled: _disabled, ...sliderProps } = props
  
  return (
    <div className={cn("relative audio-volume-slider", className)}>
      <SliderPrimitive.Root
        ref={ref}
        className="relative flex w-full select-none items-center cursor-pointer"
        onValueChange={onValueChange}
        {...sliderProps}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb 
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SliderPrimitive.Root>
    </div>
  )
})

AudioVolumeSlider.displayName = "AudioVolumeSlider"

export { AudioVolumeSlider }