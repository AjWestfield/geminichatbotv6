'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Image as ImageIcon, 
  Video, 
  Zap,
  Calendar,
  Download,
  RefreshCw,
  PieChart,
  Activity,
  Target,
  Award
} from 'lucide-react'
import { GeneratedImage } from '@/lib/image-generation-types'

interface AnalyticsDashboardProps {
  images: GeneratedImage[]
  videos?: any[]
  chats?: any[]
}

interface AnalyticsData {
  totalImages: number
  totalVideos: number
  totalChats: number
  averageImagesPerDay: number
  mostUsedModel: string
  mostUsedStyle: string
  mostUsedQuality: string
  totalPromptLength: number
  averagePromptLength: number
  creationTrends: { date: string; count: number }[]
  modelUsage: { model: string; count: number; percentage: number }[]
  qualityDistribution: { quality: string; count: number; percentage: number }[]
  styleDistribution: { style: string; count: number; percentage: number }[]
  timeOfDayUsage: { hour: number; count: number }[]
  weeklyActivity: { day: string; count: number }[]
}

export function AnalyticsDashboard({ images, videos = [], chats = [] }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [refreshing, setRefreshing] = useState(false)

  const analyticsData = useMemo((): AnalyticsData => {
    // Filter data based on time range
    const now = new Date()
    const cutoffDate = new Date()
    
    switch (timeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoffDate.setDate(now.getDate() - 90)
        break
      case 'all':
        cutoffDate.setFullYear(2020) // Far in the past
        break
    }

    const filteredImages = images.filter(img => new Date(img.timestamp) >= cutoffDate)
    const filteredVideos = videos.filter(video => new Date(video.timestamp || video.createdAt) >= cutoffDate)

    // Calculate basic metrics
    const totalImages = filteredImages.length
    const totalVideos = filteredVideos.length
    const totalChats = chats.length

    const daysDiff = Math.max(1, (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24))
    const averageImagesPerDay = totalImages / daysDiff

    // Model usage analysis
    const modelCounts = filteredImages.reduce((acc, img) => {
      acc[img.model] = (acc[img.model] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const modelUsage = Object.entries(modelCounts)
      .map(([model, count]) => ({
        model,
        count,
        percentage: (count / totalImages) * 100
      }))
      .sort((a, b) => b.count - a.count)

    const mostUsedModel = modelUsage[0]?.model || 'None'

    // Style analysis
    const styleCounts = filteredImages.reduce((acc, img) => {
      const style = img.style || 'default'
      acc[style] = (acc[style] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const styleDistribution = Object.entries(styleCounts)
      .map(([style, count]) => ({
        style,
        count,
        percentage: (count / totalImages) * 100
      }))
      .sort((a, b) => b.count - a.count)

    const mostUsedStyle = styleDistribution[0]?.style || 'None'

    // Quality analysis
    const qualityCounts = filteredImages.reduce((acc, img) => {
      const quality = img.quality || 'standard'
      acc[quality] = (acc[quality] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const qualityDistribution = Object.entries(qualityCounts)
      .map(([quality, count]) => ({
        quality,
        count,
        percentage: (count / totalImages) * 100
      }))
      .sort((a, b) => b.count - a.count)

    const mostUsedQuality = qualityDistribution[0]?.quality || 'None'

    // Prompt analysis
    const totalPromptLength = filteredImages.reduce((sum, img) => sum + img.prompt.length, 0)
    const averagePromptLength = totalImages > 0 ? totalPromptLength / totalImages : 0

    // Time-based analysis
    const creationTrends = generateCreationTrends(filteredImages, cutoffDate, now)
    const timeOfDayUsage = generateTimeOfDayUsage(filteredImages)
    const weeklyActivity = generateWeeklyActivity(filteredImages)

    return {
      totalImages,
      totalVideos,
      totalChats,
      averageImagesPerDay,
      mostUsedModel,
      mostUsedStyle,
      mostUsedQuality,
      totalPromptLength,
      averagePromptLength,
      creationTrends,
      modelUsage,
      qualityDistribution,
      styleDistribution,
      timeOfDayUsage,
      weeklyActivity
    }
  }, [images, videos, chats, timeRange])

  const generateCreationTrends = (images: GeneratedImage[], startDate: Date, endDate: Date) => {
    const trends: { date: string; count: number }[] = []
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const count = images.filter(img => {
        const imgDate = new Date(img.timestamp).toISOString().split('T')[0]
        return imgDate === dateStr
      }).length
      
      trends.push({ date: dateStr, count })
      current.setDate(current.getDate() + 1)
    }
    
    return trends
  }

  const generateTimeOfDayUsage = (images: GeneratedImage[]) => {
    const hourCounts = Array(24).fill(0)
    
    images.forEach(img => {
      const hour = new Date(img.timestamp).getHours()
      hourCounts[hour]++
    })
    
    return hourCounts.map((count, hour) => ({ hour, count }))
  }

  const generateWeeklyActivity = (images: GeneratedImage[]) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayCounts = Array(7).fill(0)
    
    images.forEach(img => {
      const day = new Date(img.timestamp).getDay()
      dayCounts[day]++
    })
    
    return dayCounts.map((count, index) => ({ day: dayNames[index], count }))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const exportAnalytics = () => {
    const exportData = {
      generatedAt: new Date().toISOString(),
      timeRange,
      analytics: analyticsData
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${timeRange}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics Dashboard
          </h2>
          <p className="text-gray-400">Insights into your AI generation patterns and usage</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="7d" className="text-white hover:bg-gray-700">Last 7 days</SelectItem>
              <SelectItem value="30d" className="text-white hover:bg-gray-700">Last 30 days</SelectItem>
              <SelectItem value="90d" className="text-white hover:bg-gray-700">Last 90 days</SelectItem>
              <SelectItem value="all" className="text-white hover:bg-gray-700">All time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button
            onClick={exportAnalytics}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Total Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{analyticsData.totalImages}</div>
            <p className="text-xs text-gray-400">
              {analyticsData.averageImagesPerDay.toFixed(1)} per day
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Video className="h-4 w-4" />
              Total Videos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{analyticsData.totalVideos}</div>
            <p className="text-xs text-gray-400">
              {timeRange} period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg Prompt Length
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{Math.round(analyticsData.averagePromptLength)}</div>
            <p className="text-xs text-gray-400">
              characters
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Top Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-white truncate">{analyticsData.mostUsedModel}</div>
            <p className="text-xs text-gray-400">
              {analyticsData.modelUsage[0]?.count || 0} uses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Model Usage
            </CardTitle>
            <CardDescription>Distribution of AI models used</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.modelUsage.slice(0, 5).map((item, index) => (
                <div key={item.model} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                    />
                    <span className="text-sm text-gray-300 truncate">{item.model}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{item.count}</span>
                    <Badge variant="secondary" className="text-xs">
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quality Distribution */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quality Distribution
            </CardTitle>
            <CardDescription>Image quality preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.qualityDistribution.map((item, index) => (
                <div key={item.quality} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.quality === 'hd' ? '#10b981' : '#6b7280' }}
                    />
                    <span className="text-sm text-gray-300 capitalize">{item.quality}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{item.count}</span>
                    <Badge variant="secondary" className="text-xs">
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Time of Day Usage */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Usage by Time of Day
            </CardTitle>
            <CardDescription>When you're most active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analyticsData.timeOfDayUsage
                .filter(item => item.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((item) => (
                  <div key={item.hour} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">
                      {item.hour.toString().padStart(2, '0')}:00
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ 
                            width: `${(item.count / Math.max(...analyticsData.timeOfDayUsage.map(t => t.count))) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-white w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Activity */}
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Activity
            </CardTitle>
            <CardDescription>Activity by day of week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analyticsData.weeklyActivity
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div key={item.day} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 w-20">{item.day}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ 
                            width: `${(item.count / Math.max(...analyticsData.weeklyActivity.map(w => w.count))) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-white w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
