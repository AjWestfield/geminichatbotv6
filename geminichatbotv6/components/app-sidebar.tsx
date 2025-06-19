"use client"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion } from "framer-motion"
import {
  ChevronsUpDown,
  Code,
  FileText,
  History,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Music,
  Plus,
  Settings,
  UserCircle,
  Video,
  Search,
  Trash2,
  Edit3,
  SortAsc,
  SortDesc,
  Calendar,
  Clock,
  Activity,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { useChatPersistence } from "@/hooks/use-chat-persistence"
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns"
import { Input } from "@/components/ui/input"
import { formatChatTitleWithTime } from "@/lib/chat-naming"
import { formatChatDate, formatMessageCount } from "@/lib/format-utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


const sidebarVariants = {
  open: {
    width: "20rem", // Increased from 15rem to 20rem for better visibility
    boxShadow: "var(--sidebar-shadow)",
  },
  closed: {
    width: "3.05rem",
    boxShadow: "none",
  },
}

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
}

const variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      x: { stiffness: 1000, velocity: -100 },
    },
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: {
      x: { stiffness: 100 },
    },
  },
}

const transitionProps = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
  staggerChildren: 0.1,
}

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
}

interface SidebarProps {
  currentChatId?: string | null
  onChatSelect?: (chatId: string) => void
  onNewChat?: () => void
  refreshKey?: number
}

type CombinedSortOption = 
  | 'newest-relative'
  | 'newest-absolute' 
  | 'oldest-relative'
  | 'oldest-absolute'
  | 'alphabetical-relative'
  | 'alphabetical-absolute'

interface ChatListItemProps {
  chat: any
  currentChatId?: string | null
  isCollapsed: boolean
  editingChatId: string | null
  editingTitle: string
  onChatSelect: (chatId: string) => void
  onEditChat: (chatId: string, title: string) => void
  onDeleteChat: (chatId: string) => void
  onSaveEdit: () => void
  setEditingChatId: (id: string | null) => void
  setEditingTitle: (title: string) => void
  formatDateDisplay: (date: Date | string) => string
}

// Memoized chat list item to prevent unnecessary re-renders and tooltip ref issues
const ChatListItem = memo(({
  chat,
  currentChatId,
  isCollapsed,
  editingChatId,
  editingTitle,
  onChatSelect,
  onEditChat,
  onDeleteChat,
  onSaveEdit,
  setEditingChatId,
  setEditingTitle,
  formatDateDisplay
}: ChatListItemProps) => {
  // Memoize date values to prevent tooltip re-renders
  const tooltipCreatedDate = useMemo(() => {
    if (!chat.created_at) return 'Unknown'
    const dateObj = new Date(chat.created_at)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24))
    
    // Today: show time only
    if (isToday(dateObj)) {
      return format(dateObj, 'h:mm a')
    }
    // Yesterday
    if (isYesterday(dateObj)) {
      return `Yesterday, ${format(dateObj, 'h:mm a')}`
    }
    // Within this week: show day name
    if (diffInDays < 7) {
      return format(dateObj, 'EEEE, h:mm a')
    }
    // Within this year: don't show year
    if (dateObj.getFullYear() === now.getFullYear()) {
      return format(dateObj, 'MMM d, h:mm a')
    }
    // Older: show full date
    return format(dateObj, 'MMM d yyyy, h:mm a')
  }, [chat.created_at])

  const tooltipUpdatedDate = useMemo(() => {
    const date = chat.updated_at || chat.created_at
    if (!date) return 'Unknown'
    const dateObj = new Date(date)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24))
    
    // Today: show time only
    if (isToday(dateObj)) {
      return format(dateObj, 'h:mm a')
    }
    // Yesterday
    if (isYesterday(dateObj)) {
      return `Yesterday, ${format(dateObj, 'h:mm a')}`
    }
    // Within this week: show day name
    if (diffInDays < 7) {
      return format(dateObj, 'EEEE, h:mm a')
    }
    // Within this year: don't show year
    if (dateObj.getFullYear() === now.getFullYear()) {
      return format(dateObj, 'MMM d, h:mm a')
    }
    // Older: show full date
    return format(dateObj, 'MMM d yyyy, h:mm a')
  }, [chat.updated_at, chat.created_at])

  const relativeTime = useMemo(() => {
    const date = chat.updated_at || chat.created_at
    if (!date) return ''
    const dateObj = new Date(date)
    const now = new Date()
    const diffInMs = now.getTime() - dateObj.getTime()
    const diffInSeconds = Math.floor(diffInMs / 1000)
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInSeconds < 60) return 'just now'
    if (diffInMinutes === 1) return '1 min ago'
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`
    if (diffInHours === 1) return '1 hour ago'
    if (diffInHours < 24) return `${diffInHours} hours ago`
    if (diffInDays === 1) return '1 day ago'
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7)
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
    }
    if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30)
      return months === 1 ? '1 month ago' : `${months} months ago`
    }
    const years = Math.floor(diffInDays / 365)
    return years === 1 ? '1 year ago' : `${years} years ago`
  }, [chat.updated_at, chat.created_at])

  const isRecent = useMemo(() => {
    const date = chat.updated_at || chat.created_at
    if (!date) return false
    const dateObj = new Date(date)
    const now = new Date()
    const diffInMs = now.getTime() - dateObj.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    return diffInHours < 24
  }, [chat.updated_at, chat.created_at])

  // Don't show tooltip when editing to prevent ref conflicts
  if (editingChatId === chat.id) {
    return (
      <div className="group px-2 mb-1">
        <div
          className={cn(
            "relative flex h-auto w-full flex-row items-start rounded-md px-2 py-2 transition hover:bg-muted hover:text-primary cursor-pointer",
            currentChatId === chat.id && "bg-muted text-blue-600",
          )}
          onClick={() => onChatSelect(chat.id)}
        >
          <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <motion.div variants={variants} className="flex-1 min-w-0 ml-2">
            {!isCollapsed && (
              <div className="flex items-center gap-1">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={onSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveEdit()
                    if (e.key === 'Escape') {
                      setEditingChatId(null)
                      setEditingTitle("")
                    }
                  }}
                  className="h-7 text-sm"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="group px-2 mb-1">
          <div
            className={cn(
              "relative flex h-auto w-full flex-row items-start rounded-md px-2 py-2 transition hover:bg-muted hover:text-primary cursor-pointer",
              currentChatId === chat.id && "bg-muted text-blue-600",
            )}
            onClick={() => onChatSelect(chat.id)}
          >
            <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <motion.div variants={variants} className="flex-1 min-w-0 ml-2">
              {!isCollapsed && (
                <div className="pr-2">
                  <p className="text-sm font-medium break-words line-clamp-2">
                    {chat.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateDisplay(chat.updated_at || chat.created_at)}
                  </p>
                </div>
              )}
            </motion.div>
            {!isCollapsed && (
              <div className="flex gap-1 ml-auto flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditChat(chat.id, chat.title)
                  }}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteChat(chat.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="p-3 max-w-xs bg-zinc-900 border-zinc-800 text-white">
        <div className="space-y-2.5">
          {/* Chat Title */}
          <div className="pb-1.5 border-b border-zinc-700">
            <p className="text-sm font-semibold text-zinc-100 line-clamp-2">{chat.title || 'Untitled Chat'}</p>
          </div>

          {/* Created Date */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
              <Calendar className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Created</div>
              <div className="text-sm font-medium text-zinc-100">
                {tooltipCreatedDate}
              </div>
            </div>
          </div>

          {/* Updated Date */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10">
              <Clock className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Last Update</div>
              <div className="text-sm font-medium text-zinc-100">
                {tooltipUpdatedDate}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {relativeTime}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="pt-2 mt-2 border-t border-zinc-700 flex items-center justify-between">
            {/* Message Count */}
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-300">
                {chat.message_count || 0} {chat.message_count === 1 ? 'message' : 'messages'}
              </span>
            </div>

            {/* Activity Status */}
            {isRecent && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">Active</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
})

ChatListItem.displayName = 'ChatListItem'

export function AppSidebar({ currentChatId, onChatSelect, onNewChat, refreshKey }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [sortAndDisplay, setSortAndDisplay] = useState<CombinedSortOption>('newest-relative')
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set())
  const pathname = usePathname()
  
  // Helper functions for dropdown state management
  const handleDropdownOpenChange = useCallback((dropdownId: string, isOpen: boolean) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev)
      if (isOpen) {
        newSet.add(dropdownId)
      } else {
        newSet.delete(dropdownId)
      }
      return newSet
    })
  }, [])
  
  // Debounced collapse handlers to prevent rapid state changes
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)
  
  const handleMouseEnter = useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
    // Small delay to prevent rapid state changes
    requestAnimationFrame(() => {
      setIsCollapsed(false)
    })
  }, [])
  
  const handleMouseLeave = useCallback(() => {
    // Don't collapse if any dropdown is open
    if (openDropdowns.size > 0) {
      return
    }
    
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setIsCollapsed(true)
      collapseTimeoutRef.current = null
    }, 150)
  }, [openDropdowns])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current)
      }
    }
  }, [])
  
  const {
    chats,
    deleteChat,
    updateChatTitle,
    searchChats,
    refreshChats,
  } = useChatPersistence(currentChatId || undefined)

  // Refresh chats when refreshKey changes
  useEffect(() => {
    if (refreshKey && refreshKey > 0 && !isRefreshingRef.current) {
      console.log('[SIDEBAR] Refresh triggered by key change:', refreshKey)
      isRefreshingRef.current = true
      
      // Add a small delay to prevent rapid successive calls
      const timeoutId = setTimeout(async () => {
        try {
          await refreshChats()
        } finally {
          isRefreshingRef.current = false
        }
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [refreshKey, refreshChats])

  // Sort chats based on selected option
  const sortChats = useMemo(() => {
    return (chatsToSort: typeof chats) => {
      const sortMethod = sortAndDisplay.split('-')[0] as 'newest' | 'oldest' | 'alphabetical'
      
      return [...chatsToSort].sort((a, b) => {
        switch (sortMethod) {
          case 'newest':
            return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
          case 'oldest':
            return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime()
          case 'alphabetical':
            return a.title.localeCompare(b.title)
          default:
            return 0
        }
      })
    }
  }, [sortAndDisplay])

  // Group chats by time period (remove empty chats filter)
  const groupedChats = useMemo(() => {
    const groups: Record<string, typeof chats> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      'This Month': [],
      Older: [],
    }

    // Show all chats, not just ones with messages
    const validChats = sortChats(chats)

    validChats.forEach(chat => {
      const date = new Date(chat.updated_at || chat.created_at)
      
      if (isToday(date)) {
        groups.Today.push(chat)
      } else if (isYesterday(date)) {
        groups.Yesterday.push(chat)
      } else if (isThisWeek(date)) {
        groups['This Week'].push(chat)
      } else if (isThisMonth(date)) {
        groups['This Month'].push(chat)
      } else {
        groups.Older.push(chat)
      }
    })

    return Object.entries(groups).filter(([_, chats]) => chats.length > 0)
  }, [chats, sortAndDisplay, sortChats])

  const handleEditChat = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
  }

  const handleSaveEdit = async () => {
    if (editingChatId && editingTitle.trim()) {
      await updateChatTitle(editingChatId, editingTitle.trim())
      setEditingChatId(null)
      setEditingTitle("")
    }
  }

  const handleDeleteChat = async (chatId: string) => {
    if (confirm('Are you sure you want to delete this chat?')) {
      await deleteChat(chatId)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      await searchChats(query)
    } else {
      await refreshChats()
    }
  }

  // Format date based on display preference
  const formatDateDisplay = (date: Date | string) => {
    const chatDate = typeof date === 'string' ? new Date(date) : date
    const timeDisplayMode = sortAndDisplay.split('-')[1] as 'relative' | 'absolute'
    
    if (timeDisplayMode === 'relative') {
      return formatChatDate(date)
    } else {
      return format(chatDate, 'MMM d, yyyy h:mm a')
    }
  }

  return (
    <TooltipProvider>
      <motion.div
        className={cn("sidebar fixed left-0 z-50 h-full shrink-0 border-r bg-white dark:bg-black")}
        initial={isCollapsed ? "closed" : "open"}
        animate={isCollapsed ? "closed" : "open"}
        variants={sidebarVariants}
        transition={transitionProps}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className={`relative z-50 flex text-muted-foreground h-full shrink-0 flex-col transition-all`}
          variants={contentVariants}
        >
          <motion.ul variants={staggerVariants} className="flex h-full flex-col">
            <div className="flex grow flex-col items-center overflow-hidden">
              <div className="flex h-[54px] w-full shrink-0 border-b p-2">
                <div className="mt-[1.5px] flex w-full">
                  <DropdownMenu modal={false} onOpenChange={(isOpen) => handleDropdownOpenChange('main', isOpen)}>
                    <DropdownMenuTrigger className="w-full" asChild>
                      <Button variant="ghost" size="sm" className="flex w-fit items-center gap-2 px-2">
                        <Avatar className="rounded size-4">
                          <AvatarFallback>A</AvatarFallback>
                        </Avatar>
                        <motion.li variants={variants} className="flex w-fit items-center gap-2">
                          {!isCollapsed && (
                            <>
                              <p className="text-sm font-medium">Gemini AI</p>
                              <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                            </>
                          )}
                        </motion.li>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem asChild className="flex items-center gap-2">
                        <Link href="/settings">
                          <Settings className="h-4 w-4" /> Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="flex items-center gap-2">
                        <Link href="/new-project">
                          <Plus className="h-4 w-4" /> New Project
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex h-full w-full flex-col">
                <ScrollArea className="flex-1 p-2" key="sidebar-scroll-area">
                  <div className={cn("flex w-full flex-col gap-1")}>
                    {/* New Chat Button */}
                    {!isCollapsed && (
                      <div className="mb-3 px-2">
                        <Button
                          onClick={onNewChat}
                          className="w-full justify-start gap-2"
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="h-4 w-4" />
                          New Chat
                        </Button>
                      </div>
                    )}

                    {/* Search and Sort Controls */}
                    {!isCollapsed && (
                      <>
                        <div className="mb-2 px-2">
                          <Input
                            type="search"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        <div className="mb-4 px-2">
                          <DropdownMenu onOpenChange={(isOpen) => handleDropdownOpenChange('sort', isOpen)}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full justify-start">
                                {(() => {
                                  const [sort, time] = sortAndDisplay.split('-')
                                  
                                  // Primary icon based on sort method
                                  let SortIcon = SortDesc
                                  if (sort === 'oldest') SortIcon = SortAsc
                                  else if (sort === 'alphabetical') SortIcon = SortAsc
                                  
                                  // Secondary icon based on time display
                                  const TimeIcon = time === 'relative' ? Clock : Calendar
                                  
                                  const sortLabel = sort === 'newest' ? 'Newest First' : sort === 'oldest' ? 'Oldest First' : 'A-Z'
                                  const timeLabel = time === 'relative' ? 'Relative Time' : 'Exact Time'
                                  
                                  return (
                                    <>
                                      <SortIcon className="h-3 w-3 mr-1" />
                                      <TimeIcon className="h-3 w-3 mr-2" />
                                      <span className="font-medium">{sortLabel}</span>
                                      <span className="text-xs text-muted-foreground ml-1">• {timeLabel}</span>
                                    </>
                                  )
                                })()}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64">
                              <DropdownMenuLabel>Chat Sorting & Time Format</DropdownMenuLabel>
                              <DropdownMenuRadioGroup value={sortAndDisplay} onValueChange={(value) => setSortAndDisplay(value as CombinedSortOption)}>
                                <div className="px-2 py-1">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">NEWEST FIRST</div>
                                </div>
                                <DropdownMenuRadioItem value="newest-relative">
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-blue-600" />
                                      <span className="font-medium">Relative Time</span>
                                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Default</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-5 mt-0.5">Shows "2m ago", "1h ago", etc.</span>
                                  </div>
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="newest-absolute">
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3 text-green-600" />
                                      <span className="font-medium">Exact Timestamps</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-5 mt-0.5">Shows "Jan 5, 2:30 PM"</span>
                                  </div>
                                </DropdownMenuRadioItem>
                                
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">OLDEST FIRST</div>
                                </div>
                                <DropdownMenuRadioItem value="oldest-relative">
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-blue-600" />
                                      <span className="font-medium">Relative Time</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-5 mt-0.5">Shows "2m ago", "1h ago", etc.</span>
                                  </div>
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="oldest-absolute">
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3 text-green-600" />
                                      <span className="font-medium">Exact Timestamps</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-5 mt-0.5">Shows "Jan 5, 2:30 PM"</span>
                                  </div>
                                </DropdownMenuRadioItem>
                                
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">ALPHABETICAL</div>
                                </div>
                                <DropdownMenuRadioItem value="alphabetical-relative">
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-blue-600" />
                                      <span className="font-medium">Relative Time</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-5 mt-0.5">Shows "2m ago", "1h ago", etc.</span>
                                  </div>
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="alphabetical-absolute">
                                  <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3 text-green-600" />
                                      <span className="font-medium">Exact Timestamps</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-5 mt-0.5">Shows "Jan 5, 2:30 PM"</span>
                                  </div>
                                </DropdownMenuRadioItem>
                              </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    )}

                    {/* Clear Chat History Button */}
                    {!isCollapsed && chats.length > 0 && (
                      <div className="mb-4 px-2">
                        <Button
                          onClick={async () => {
                            if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
                              for (const chat of chats) {
                                await deleteChat(chat.id)
                              }
                              onNewChat?.()
                            }
                          }}
                          className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          Clear Chat History
                        </Button>
                      </div>
                    )}

                    {/* Chat History Section */}
                    {groupedChats.map(([period, periodChats]) => (
                      <div key={period} className="mb-4">
                        <div className="mb-1 px-2">
                          <motion.div variants={variants} className="flex items-center">
                            {!isCollapsed && (
                              <p className="text-xs font-semibold text-muted-foreground">{period.toUpperCase()}</p>
                            )}
                          </motion.div>
                        </div>

                        {periodChats.map((chat) => (
                          <ChatListItem
                            key={chat.id}
                            chat={chat}
                            currentChatId={currentChatId}
                            isCollapsed={isCollapsed}
                            editingChatId={editingChatId}
                            editingTitle={editingTitle}
                            onChatSelect={onChatSelect || (() => {})}
                            onEditChat={handleEditChat}
                            onDeleteChat={handleDeleteChat}
                            onSaveEdit={handleSaveEdit}
                            setEditingChatId={setEditingChatId}
                            setEditingTitle={setEditingTitle}
                            formatDateDisplay={formatDateDisplay}
                          />
                        ))}
                      </div>
                    ))}

                    {chats.length === 0 && !isCollapsed && (
                      <div className="px-2 py-4 text-center">
                        <p className="text-sm text-muted-foreground">No chats yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Start a new conversation!</p>
                      </div>
                    )}

                    <Separator className="my-2" />

                    {/* Canvas Tabs */}
                    <div className="mt-2 mb-1 px-2">
                      <motion.div variants={variants} className="flex items-center">
                        {!isCollapsed && <p className="text-xs font-semibold text-muted-foreground">CANVAS</p>}
                      </motion.div>
                    </div>

                    <Link
                      href="/canvas/preview"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.includes("/canvas/preview") && "bg-muted text-blue-600",
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Preview</p>}
                      </motion.li>
                    </Link>

                    <Link
                      href="/canvas/code"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.includes("/canvas/code") && "bg-muted text-blue-600",
                      )}
                    >
                      <Code className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Code</p>}
                      </motion.li>
                    </Link>

                    <Link
                      href="/canvas/images"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.includes("/canvas/images") && "bg-muted text-blue-600",
                      )}
                    >
                      <ImageIcon className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Images</p>}
                      </motion.li>
                    </Link>

                    <Link
                      href="/canvas/video"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.includes("/canvas/video") && "bg-muted text-blue-600",
                      )}
                    >
                      <Video className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Video</p>}
                      </motion.li>
                    </Link>

                    <Link
                      href="/canvas/audio"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.includes("/canvas/audio") && "bg-muted text-blue-600",
                      )}
                    >
                      <Music className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Audio</p>}
                      </motion.li>
                    </Link>

                    <Link
                      href="/canvas/docs"
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary",
                        pathname?.includes("/canvas/docs") && "bg-muted text-blue-600",
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Docs</p>}
                      </motion.li>
                    </Link>

                    {/* Footer Actions - Now inside the ScrollArea */}
                    <Separator className="my-2" />
                    
                    <div className="mt-2 mb-1 px-2">
                      <motion.div variants={variants} className="flex items-center">
                        {!isCollapsed && <p className="text-xs font-semibold text-muted-foreground">ACCOUNT</p>}
                      </motion.div>
                    </div>

                    <Link
                      href="/settings"
                      className="flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary"
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                      <motion.li variants={variants}>
                        {!isCollapsed && <p className="ml-2 text-sm font-medium">Settings</p>}
                      </motion.li>
                    </Link>

                    <div>
                      <DropdownMenu modal={false} onOpenChange={(isOpen) => handleDropdownOpenChange('user', isOpen)}>
                        <DropdownMenuTrigger className="w-full">
                          <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted hover:text-primary">
                            <Avatar className="size-4">
                              <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                            <motion.li variants={variants} className="flex w-full items-center gap-2">
                              {!isCollapsed && (
                                <>
                                  <p className="text-sm font-medium">User</p>
                                  <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/50" />
                                </>
                              )}
                            </motion.li>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent sideOffset={5}>
                          <div className="flex flex-row items-center gap-2 p-2">
                            <Avatar className="size-6">
                              <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-medium">User</span>
                              <span className="line-clamp-1 text-xs text-muted-foreground">user@example.com</span>
                            </div>
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild className="flex items-center gap-2">
                            <Link href="/profile">
                              <UserCircle className="h-4 w-4" /> Profile
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <LogOut className="h-4 w-4" /> Sign out
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Add padding at the bottom to ensure last items are visible */}
                    <div className="h-4" />
                  </div>
                </ScrollArea>
              </div>
            </div>
          </motion.ul>
        </motion.div>
      </motion.div>
    </TooltipProvider>
  )
}