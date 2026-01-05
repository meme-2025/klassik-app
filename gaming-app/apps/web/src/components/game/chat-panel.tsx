'use client'

import { useState } from 'react'
import { MessageCircle, Send, Smile } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  username: string
  text: string
  timestamp: number
}

const mockMessages: Message[] = [
  { id: '1', username: 'CryptoKing', text: 'LFG! 🚀', timestamp: Date.now() - 60000 },
  { id: '2', username: 'MoonShot', text: 'Just won 50x!', timestamp: Date.now() - 45000 },
  { id: '3', username: 'DiamondHands', text: 'HODL!', timestamp: Date.now() - 30000 },
]

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [input, setInput] = useState('')

  const sendMessage = () => {
    if (!input.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      username: 'You',
      text: input,
      timestamp: Date.now(),
    }

    setMessages([...messages, newMessage])
    setInput('')
  }

  return (
    <div className="glass-morphism rounded-xl p-6 flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-kaspa-blue" />
        <h3 className="text-lg font-display font-bold">Live Chat</h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3 mb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-2 rounded-lg bg-slate-800/50"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-kaspa-blue">
                  {msg.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm">{msg.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button onClick={sendMessage} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
