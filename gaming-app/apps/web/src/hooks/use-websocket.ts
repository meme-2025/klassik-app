'use client'

import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '@/lib/store/game-store'
import { toast } from 'sonner'

let socket: Socket | null = null

export function useWebSocket() {
  const { 
    setGameState, 
    setCurrentMultiplier, 
    setCrashPoint,
    addToHistory,
    addPlayer,
    updatePlayer,
    removePlayer,
  } = useGameStore()

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'
    
    socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
      toast.success('Connected to game server')
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      toast.error('Disconnected from game server')
    })

    socket.on('game:state', (data: { state: string; gameId: string }) => {
      setGameState(data.state as any)
      useGameStore.setState({ gameId: data.gameId })
    })

    socket.on('game:multiplier', (data: { multiplier: number }) => {
      setCurrentMultiplier(data.multiplier)
    })

    socket.on('game:crashed', (data: { crashPoint: number; gameId: string }) => {
      setCrashPoint(data.crashPoint)
      setGameState('crashed')
      addToHistory({
        gameId: data.gameId,
        crashPoint: data.crashPoint,
        timestamp: Date.now(),
      })
      toast.error(`Crashed at ${data.crashPoint.toFixed(2)}x!`, { icon: '💥' })
    })

    socket.on('player:joined', (player: any) => {
      addPlayer(player)
    })

    socket.on('player:bet', (data: any) => {
      updatePlayer(data.playerId, { betAmount: data.amount })
    })

    socket.on('player:cashout', (data: any) => {
      updatePlayer(data.playerId, {
        cashedOut: true,
        cashoutMultiplier: data.multiplier,
        winAmount: data.winAmount,
      })
    })

    socket.on('player:left', (data: { playerId: string }) => {
      removePlayer(data.playerId)
    })

    socket.on('error', (error: any) => {
      console.error('WebSocket error:', error)
      toast.error('Connection error')
    })

    return () => {
      if (socket) {
        socket.disconnect()
        socket = null
      }
    }
  }, [])

  return socket
}
