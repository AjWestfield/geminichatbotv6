"use client"

import { useEffect, useState } from "react"
import { Check, X, Database } from "lucide-react"

export function PersistenceNotification() {
  const [persistenceStatus, setPersistenceStatus] = useState<'checking' | 'enabled' | 'disabled' | null>(null)
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    const checkPersistence = async () => {
      try {
        // Check if we've already shown the notification in this session
        const hasShownNotification = sessionStorage.getItem('persistence-notification-shown')
        if (hasShownNotification === 'true') {
          return
        }

        setPersistenceStatus('checking')
        const response = await fetch('/api/check-persistence')
        const data = await response.json()
        
        setPersistenceStatus(data.configured ? 'enabled' : 'disabled')
        setShowNotification(true)
        
        // Mark as shown in this session
        sessionStorage.setItem('persistence-notification-shown', 'true')
        
        // Hide notification after 5 seconds
        setTimeout(() => {
          setShowNotification(false)
        }, 5000)
      } catch (error) {
        setPersistenceStatus('disabled')
        setShowNotification(true)
        
        // Mark as shown in this session
        sessionStorage.setItem('persistence-notification-shown', 'true')
        
        setTimeout(() => {
          setShowNotification(false)
        }, 5000)
      }
    }

    checkPersistence()
  }, [])

  if (!showNotification || !persistenceStatus || persistenceStatus === 'checking') {
    return null
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
      persistenceStatus === 'enabled' 
        ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
        : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
    }`}>
      <Database className="w-4 h-4" />
      <span className="text-sm font-medium">
        {persistenceStatus === 'enabled' 
          ? 'Database persistence enabled' 
          : 'Database persistence disabled (using local storage)'}
      </span>
      {persistenceStatus === 'enabled' ? (
        <Check className="w-4 h-4" />
      ) : (
        <X className="w-4 h-4" />
      )}
    </div>
  )
}