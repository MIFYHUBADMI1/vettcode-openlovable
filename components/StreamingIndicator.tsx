'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface StreamingIndicatorProps {
  isStreaming: boolean;
  totalChars: number;
  status?: string;
}

export default function StreamingIndicator({ isStreaming, totalChars, status }: StreamingIndicatorProps) {
  const [charsPerSecond, setCharsPerSecond] = useState(0);
  const [lastCharCount, setLastCharCount] = useState(0);
  const [lastTime, setLastTime] = useState(Date.now());
  
  // Calculate streaming speed
  useEffect(() => {
    if (isStreaming && totalChars > lastCharCount) {
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000; // Convert to seconds
      const charDiff = totalChars - lastCharCount;
      
      if (timeDiff > 0) {
        const speed = Math.round(charDiff / timeDiff);
        setCharsPerSecond(speed);
      }
      
      setLastCharCount(totalChars);
      setLastTime(now);
    }
  }, [totalChars, isStreaming]);
  
  // Reset when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      setCharsPerSecond(0);
      setLastCharCount(0);
      setLastTime(Date.now());
    }
  }, [isStreaming]);
  
  if (!isStreaming) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="fixed top-4 right-4 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-sm border border-white/20"
    >
      <div className="flex items-center gap-3">
        {/* Animated streaming indicator */}
        <div className="relative">
          <div className="w-3 h-3 bg-white rounded-full animate-ping absolute" />
          <div className="w-3 h-3 bg-white rounded-full relative" />
        </div>
        
        {/* Status text */}
        <div className="flex flex-col">
          <span className="text-sm font-bold">AI Streaming Live</span>
          <div className="flex items-center gap-2 text-xs opacity-90">
            <span>{totalChars.toLocaleString()} chars</span>
            {charsPerSecond > 0 && (
              <>
                <span>•</span>
                <span className="font-mono">{charsPerSecond} chars/s</span>
              </>
            )}
          </div>
        </div>
        
        {/* Animated bars */}
        <div className="flex items-end gap-0.5 h-4">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-white rounded-full"
              animate={{
                height: ['40%', '100%', '40%'],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
