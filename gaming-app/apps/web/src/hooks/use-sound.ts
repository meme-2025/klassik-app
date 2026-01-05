'use client'

import { useCallback, useRef } from 'react'

type SoundName = 'bet' | 'win' | 'cashout' | 'crash' | 'tick' | 'notification'

export function useSound() {
  const isMutedRef = useRef(false)

  const playSound = useCallback((name: SoundName, volume: number = 0.5) => {
    if (isMutedRef.current) return
    
    // TODO: Implement sound playback when audio files are added
    console.log(`[Sound] ${name} (volume: ${volume})`)
  }, [])

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current
    return isMutedRef.current
  }, [])

  return {
    playSound,
    toggleMute,
    isMuted: isMutedRef.current,
  }
}
