import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface VideoOption {
  id: string
  label: string
  description: string
}

interface VideoOptionsCardProps {
  options: VideoOption[]
  onSelect: (optionId: string) => void
  videoUri: string
}

export function VideoOptionsCard({ options, onSelect }: VideoOptionsCardProps) {
  return (
    <Card className="bg-[#3C3C3C] border-[#444444] p-4 space-y-3">
      <h3 className="text-white font-medium text-lg">What would you like to do with this video?</h3>
      <div className="grid gap-2">
        {options.map((option) => (
          <Button
            key={option.id}
            onClick={() => onSelect(option.id)}
            variant="outline"
            className="w-full justify-start text-left p-4 h-auto bg-[#2B2B2B] hover:bg-[#333333] border-[#444444] hover:border-[#555555] transition-all"
          >
            <div className="space-y-1">
              <div className="font-medium text-white text-base">{option.label}</div>
              <div className="text-sm text-gray-400 font-normal">{option.description}</div>
            </div>
          </Button>
        ))}
      </div>
    </Card>
  )
}