'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rocket, Zap, Shield, Trophy } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto redirect to lobby after 2 seconds
    const timer = setTimeout(() => {
      router.push('/lobby');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        {/* Logo */}
        <motion.div
          className="mb-8"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="inline-block glass-morphism p-6 rounded-full neon-border">
            <Rocket className="w-20 h-20 text-kaspa-blue" />
          </div>
        </motion.div>

        {/* Title */}
        <h1 className="text-6xl font-display font-bold mb-4">
          Klassik <span className="text-kaspa-blue">Gaming</span>
        </h1>

        <p className="text-xl text-gray-400 mb-8">
          Powered by Kaspa BlockDAG
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="glass-morphism p-6 rounded-xl">
            <Zap className="w-10 h-10 text-kaspa-blue mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Instant Payments</h3>
            <p className="text-sm text-gray-400">
              6-second confirmations with Kaspa
            </p>
          </div>

          <div className="glass-morphism p-6 rounded-xl">
            <Shield className="w-10 h-10 text-neon-green mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Provably Fair</h3>
            <p className="text-sm text-gray-400">
              Cryptographically verified games
            </p>
          </div>

          <div className="glass-morphism p-6 rounded-xl">
            <Trophy className="w-10 h-10 text-neon-purple mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Real Prizes</h3>
            <p className="text-sm text-gray-400">
              Win KAS, instant payouts
            </p>
          </div>
        </div>

        {/* Loading */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-kaspa-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-kaspa-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-kaspa-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="text-gray-500 mt-4">Loading game lobby...</p>
      </motion.div>
    </main>
  );
}
