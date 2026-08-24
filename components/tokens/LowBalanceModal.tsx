"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coins, TrendingUp, Sparkles } from "lucide-react";
import Link from "next/link";

interface LowBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  estimatedTokens: number;
  targetUrl: string;
}

export default function LowBalanceModal({
  isOpen,
  onClose,
  currentBalance,
  estimatedTokens,
  targetUrl,
}: LowBalanceModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative gradient background */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-100 via-red-50 to-pink-100 rounded-t-2xl -z-10" />

              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-3 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Great Progress! 🎉
              </h2>

              {/* Message */}
              <p className="text-gray-600 text-center mb-6 leading-relaxed">
                Your token balance seems to be a little less than the estimated{" "}
                <span className="font-semibold text-orange-600">
                  {estimatedTokens.toLocaleString()} tokens
                </span>{" "}
                needed to create a perfect clone of{" "}
                <span className="font-medium text-gray-800">
                  {(() => {
                    try {
                      return new URL(targetUrl).hostname;
                    } catch {
                      return targetUrl || 'this website';
                    }
                  })()}
                </span>{" "}
                due to the site's complexity.
              </p>

              {/* Current Balance Card */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 font-medium">
                    Current Balance
                  </span>
                  <Coins className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {currentBalance.toLocaleString()}
                  <span className="text-lg text-gray-500 ml-1">tokens</span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Required:</span>
                    <span className="font-semibold">{estimatedTokens.toLocaleString()} tokens</span>
                  </div>
                  <div className="flex justify-between text-xs text-red-600 font-medium">
                    <span>Shortage:</span>
                    <span>{(estimatedTokens - currentBalance).toLocaleString()} tokens</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-gray-300">
                    <span>Estimated Cost (UGX):</span>
                    <span className="font-semibold">
                      {(estimatedTokens - currentBalance).toLocaleString()} UGX
                    </span>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((currentBalance / estimatedTokens) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-blue-900 text-sm mb-1">
                      What you can do:
                    </h3>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Top up more tokens to continue with this website</li>
                      <li>• Try a simpler website with your current balance</li>
                      <li>• Explore our app features with available tokens</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {/* Primary CTA - Buy More Tokens (LARGE & PROMINENT) */}
                <Link href="/tokens" className="w-full">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative w-full overflow-hidden bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl"
                  >
                    {/* Animated shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    
                    <div className="relative flex items-center justify-center gap-3">
                      <Coins className="w-6 h-6 animate-pulse" />
                      <div className="flex flex-col items-start">
                        <span className="text-lg">🚀 Get More Tokens Now</span>
                        <span className="text-xs font-normal opacity-90">Continue building amazing sites!</span>
                      </div>
                    </div>
                  </motion.button>
                </Link>
                
                {/* Secondary action - smaller, less prominent */}
                <button
                  onClick={onClose}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 font-medium py-2 px-4 hover:bg-gray-50 rounded-lg transition-all duration-200"
                >
                  ← Explore simpler websites
                </button>
              </div>

              {/* Footer note */}
              <p className="text-xs text-gray-500 text-center mt-6">
                Token usage varies based on website complexity and content size
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
