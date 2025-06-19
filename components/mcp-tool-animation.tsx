import React from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

interface MCPToolAnimationProps {
  tool: string
  server: string
}

export function MCPToolAnimation({ tool, server }: MCPToolAnimationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="mb-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center space-x-3"
    >
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Zap className="w-5 h-5 text-blue-500" />
      </motion.div>
      
      <div className="flex items-center space-x-2">
        <span className="text-sm text-zinc-400">Executing tool:</span>
        <span className="text-sm font-medium text-zinc-100">{tool}</span>
        <span className="text-sm text-zinc-500">on</span>
        <span className="text-sm font-medium text-zinc-100">{server}</span>
      </div>
      
      <div className="ml-auto flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 bg-blue-500 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}
