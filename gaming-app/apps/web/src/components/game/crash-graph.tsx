'use client'

import { useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store/game-store'

export function CrashGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { gameState, currentMultiplier, crashPoint, graphHistory } = useGameStore()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Draw grid
    drawGrid(ctx, rect.width, rect.height)

    // Draw graph
    if (gameState === 'running' || gameState === 'crashed') {
      drawCrashCurve(ctx, rect.width, rect.height, currentMultiplier, gameState === 'crashed')
    }

    // Draw previous games faded in background
    if (graphHistory.length > 0) {
      drawHistory(ctx, rect.width, rect.height)
    }

  }, [gameState, currentMultiplier, crashPoint, graphHistory])

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1

    // Horizontal lines
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Vertical lines
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }

  const drawCrashCurve = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    multiplier: number,
    crashed: boolean
  ) => {
    ctx.beginPath()
    ctx.strokeStyle = crashed 
      ? 'rgba(239, 68, 68, 0.8)' 
      : 'rgba(0, 217, 255, 1)'
    ctx.lineWidth = 4
    ctx.shadowBlur = 20
    ctx.shadowColor = crashed 
      ? 'rgba(239, 68, 68, 0.5)' 
      : 'rgba(0, 217, 255, 0.5)'

    const points = []
    const maxX = width * 0.9
    
    // Generate curve points
    for (let x = 0; x <= maxX; x += 2) {
      const progress = x / maxX
      const currentMult = 1 + (multiplier - 1) * progress
      
      // Exponential curve formula
      const y = height - (Math.pow(currentMult, 1.5) / Math.pow(multiplier, 1.5)) * height * 0.9
      points.push({ x, y })
    }

    // Draw curve
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()

    // Draw glow effect
    ctx.shadowBlur = 0
    
    // Fill under curve with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, crashed 
      ? 'rgba(239, 68, 68, 0.3)' 
      : 'rgba(0, 217, 255, 0.3)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    
    ctx.fillStyle = gradient
    ctx.lineTo(maxX, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fill()
  }

  const drawHistory = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    graphHistory.slice(-3).forEach((pastGame, index) => {
      ctx.globalAlpha = 0.1 - (index * 0.03)
      drawCrashCurve(ctx, width, height, pastGame.crashPoint, true)
    })
    ctx.globalAlpha = 1
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-2xl bg-slate-950/50"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
