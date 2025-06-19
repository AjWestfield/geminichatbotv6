'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  User, 
  Palette, 
  Monitor, 
  Bell, 
  Shield, 
  Zap, 
  Save,
  RotateCcw,
  Download,
  Upload,
  Moon,
  Sun,
  Volume2,
  Eye,
  Keyboard
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface UserPreferences {
  // Appearance
  theme: 'dark' | 'light' | 'auto'
  accentColor: string
  fontSize: number
  compactMode: boolean
  showAnimations: boolean
  
  // Interface
  defaultTab: 'chat' | 'images' | 'videos' | 'audio'
  autoSwitchToResults: boolean
  showThumbnails: boolean
  gridSize: number
  showMetadata: boolean
  
  // Notifications
  enableNotifications: boolean
  soundEnabled: boolean
  notifyOnCompletion: boolean
  notifyOnErrors: boolean
  
  // Performance
  autoSaveInterval: number
  maxHistoryItems: number
  preloadImages: boolean
  enableCaching: boolean
  
  // Privacy
  saveHistory: boolean
  shareAnalytics: boolean
  autoBackup: boolean
  
  // Accessibility
  highContrast: boolean
  reducedMotion: boolean
  screenReaderMode: boolean
  keyboardNavigation: boolean
  
  // Advanced
  developerMode: boolean
  debugLogging: boolean
  experimentalFeatures: boolean
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  accentColor: '#6366f1',
  fontSize: 14,
  compactMode: false,
  showAnimations: true,
  defaultTab: 'chat',
  autoSwitchToResults: true,
  showThumbnails: true,
  gridSize: 3,
  showMetadata: true,
  enableNotifications: true,
  soundEnabled: true,
  notifyOnCompletion: true,
  notifyOnErrors: true,
  autoSaveInterval: 30,
  maxHistoryItems: 1000,
  preloadImages: true,
  enableCaching: true,
  saveHistory: true,
  shareAnalytics: false,
  autoBackup: true,
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  keyboardNavigation: true,
  developerMode: false,
  debugLogging: false,
  experimentalFeatures: false
}

export function UserPreferencesPanel() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [hasChanges, setHasChanges] = useState(false)

  // Load preferences on mount
  useEffect(() => {
    const saved = localStorage.getItem('userPreferences')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPreferences({ ...defaultPreferences, ...parsed })
      } catch (error) {
        console.error('Failed to load preferences:', error)
      }
    }
  }, [])

  // Track changes
  useEffect(() => {
    const saved = localStorage.getItem('userPreferences')
    const current = JSON.stringify(preferences)
    const savedString = saved || JSON.stringify(defaultPreferences)
    setHasChanges(current !== savedString)
  }, [preferences])

  const updatePreference = <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  const savePreferences = () => {
    localStorage.setItem('userPreferences', JSON.stringify(preferences))
    setHasChanges(false)
    
    // Apply theme immediately
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (preferences.theme === 'light') {
      document.documentElement.classList.remove('dark')
    }
    
    // Apply other immediate changes
    document.documentElement.style.setProperty('--accent-color', preferences.accentColor)
    document.documentElement.style.setProperty('--font-size', `${preferences.fontSize}px`)
    
    toast({
      title: "Preferences Saved",
      description: "Your preferences have been saved and applied.",
    })
  }

  const resetPreferences = () => {
    setPreferences(defaultPreferences)
    localStorage.removeItem('userPreferences')
    toast({
      title: "Preferences Reset",
      description: "All preferences have been reset to defaults.",
    })
  }

  const exportPreferences = () => {
    const data = JSON.stringify(preferences, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chatbot-preferences-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importPreferences = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string)
        setPreferences({ ...defaultPreferences, ...imported })
        toast({
          title: "Preferences Imported",
          description: "Preferences have been imported successfully.",
        })
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Invalid preferences file format.",
          variant: "destructive"
        })
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <User className="h-5 w-5" />
          User Preferences
          {hasChanges && (
            <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded">
              Unsaved Changes
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Customize your experience and interface preferences
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="appearance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-gray-800">
            <TabsTrigger value="appearance" className="data-[state=active]:bg-gray-700">
              <Palette className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="interface" className="data-[state=active]:bg-gray-700">
              <Monitor className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Interface</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-gray-700">
              <Bell className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-gray-700">
              <Zap className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="data-[state=active]:bg-gray-700">
              <Eye className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Accessibility</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Theme</Label>
                <Select 
                  value={preferences.theme} 
                  onValueChange={(value: any) => updatePreference('theme', value)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="dark" className="text-white hover:bg-gray-700">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="light" className="text-white hover:bg-gray-700">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="auto" className="text-white hover:bg-gray-700">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Auto
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={preferences.accentColor}
                    onChange={(e) => updatePreference('accentColor', e.target.value)}
                    className="w-16 h-10 bg-gray-800 border-gray-600"
                  />
                  <Input
                    type="text"
                    value={preferences.accentColor}
                    onChange={(e) => updatePreference('accentColor', e.target.value)}
                    className="flex-1 bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Font Size: {preferences.fontSize}px
                </Label>
                <Slider
                  value={[preferences.fontSize]}
                  onValueChange={([value]) => updatePreference('fontSize', value)}
                  min={12}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Compact Mode</Label>
                  <Switch
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) => updatePreference('compactMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Show Animations</Label>
                  <Switch
                    checked={preferences.showAnimations}
                    onCheckedChange={(checked) => updatePreference('showAnimations', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interface" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Default Tab</Label>
                <Select 
                  value={preferences.defaultTab} 
                  onValueChange={(value: any) => updatePreference('defaultTab', value)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="chat" className="text-white hover:bg-gray-700">Chat</SelectItem>
                    <SelectItem value="images" className="text-white hover:bg-gray-700">Images</SelectItem>
                    <SelectItem value="videos" className="text-white hover:bg-gray-700">Videos</SelectItem>
                    <SelectItem value="audio" className="text-white hover:bg-gray-700">Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Grid Size: {preferences.gridSize} columns
                </Label>
                <Slider
                  value={[preferences.gridSize]}
                  onValueChange={([value]) => updatePreference('gridSize', value)}
                  min={2}
                  max={6}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Auto-switch to Results</Label>
                  <Switch
                    checked={preferences.autoSwitchToResults}
                    onCheckedChange={(checked) => updatePreference('autoSwitchToResults', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Show Thumbnails</Label>
                  <Switch
                    checked={preferences.showThumbnails}
                    onCheckedChange={(checked) => updatePreference('showThumbnails', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Show Metadata</Label>
                  <Switch
                    checked={preferences.showMetadata}
                    onCheckedChange={(checked) => updatePreference('showMetadata', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Enable Notifications</Label>
                  <Switch
                    checked={preferences.enableNotifications}
                    onCheckedChange={(checked) => updatePreference('enableNotifications', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Sound Effects</Label>
                  <Switch
                    checked={preferences.soundEnabled}
                    onCheckedChange={(checked) => updatePreference('soundEnabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Notify on Completion</Label>
                  <Switch
                    checked={preferences.notifyOnCompletion}
                    onCheckedChange={(checked) => updatePreference('notifyOnCompletion', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Notify on Errors</Label>
                  <Switch
                    checked={preferences.notifyOnErrors}
                    onCheckedChange={(checked) => updatePreference('notifyOnErrors', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Auto-save Interval: {preferences.autoSaveInterval}s
                </Label>
                <Slider
                  value={[preferences.autoSaveInterval]}
                  onValueChange={([value]) => updatePreference('autoSaveInterval', value)}
                  min={10}
                  max={300}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Max History Items: {preferences.maxHistoryItems}
                </Label>
                <Slider
                  value={[preferences.maxHistoryItems]}
                  onValueChange={([value]) => updatePreference('maxHistoryItems', value)}
                  min={100}
                  max={5000}
                  step={100}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Preload Images</Label>
                  <Switch
                    checked={preferences.preloadImages}
                    onCheckedChange={(checked) => updatePreference('preloadImages', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Enable Caching</Label>
                  <Switch
                    checked={preferences.enableCaching}
                    onCheckedChange={(checked) => updatePreference('enableCaching', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="accessibility" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">High Contrast</Label>
                  <Switch
                    checked={preferences.highContrast}
                    onCheckedChange={(checked) => updatePreference('highContrast', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Reduced Motion</Label>
                  <Switch
                    checked={preferences.reducedMotion}
                    onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Screen Reader Mode</Label>
                  <Switch
                    checked={preferences.screenReaderMode}
                    onCheckedChange={(checked) => updatePreference('screenReaderMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-300">Keyboard Navigation</Label>
                  <Switch
                    checked={preferences.keyboardNavigation}
                    onCheckedChange={(checked) => updatePreference('keyboardNavigation', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-700">
          <Button
            onClick={savePreferences}
            disabled={!hasChanges}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          
          <Button
            onClick={resetPreferences}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={exportPreferences}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={importPreferences}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
