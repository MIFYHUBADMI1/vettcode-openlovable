"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { User, LogOut, Settings, Search as SearchIcon, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch token balance when session is available
  useEffect(() => {
    if (session?.user?.id) {
      fetchTokenBalance();
    }
  }, [session]);

  const fetchTokenBalance = async () => {
    try {
      const res = await fetch('/api/tokens/balance');
      if (res.ok) {
        const data = await res.json();
        setTokenBalance(data.tokens);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    }
  };

  // Format large numbers in a compact way
  const formatTokenBalance = (tokens: number): string => {
    if (tokens >= 1000000) {
      // Format millions (e.g., 1.5M, 2.3M)
      return (tokens / 1000000).toFixed(1) + 'M';
    } else if (tokens >= 100000) {
      // Format hundred thousands (e.g., 250K, 999K)
      return (tokens / 1000).toFixed(0) + 'K';
    } else if (tokens >= 10000) {
      // Format ten thousands (e.g., 25K, 99K)
      return (tokens / 1000).toFixed(1) + 'K';
    } else {
      // Show full number for smaller amounts
      return tokens.toLocaleString();
    }
  };

  // Get full formatted number with commas for tooltip
  const getFullTokenBalance = (tokens: number): string => {
    return tokens.toLocaleString();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-4">
        <div className="w-45 h-45 rounded-full bg-gray-200 animate-pulse"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-4">
        <Link 
          href="/login" 
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
        >
          Login
        </Link>
        <Link 
          href="/signup"
          className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-all duration-300 shadow-sm hover:shadow-md text-sm font-medium"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const userInitial = session.user?.name?.charAt(0).toUpperCase() || session.user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-orange-50 transition-all duration-200"
      >
        <div className="w-45 h-45 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
          {userInitial}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-gray-700">
            {session.user?.name || "User"}
          </p>
          <p className="text-xs text-gray-500">
            Signed In
          </p>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-140 bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden z-50"
          >
            {/* User Info */}
            <div className="p-6 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-46 h-46 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate mb-1">
                    {session.user?.name || "User"}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {session.user?.email}
                  </p>
                </div>
              </div>
              
              {/* Token Balance */}
              <div className="mt-4 p-3 bg-white rounded-lg border border-orange-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-14 h-14 text-orange-500" />
                    <span className="text-sm font-semibold text-gray-700">Tokens</span>
                  </div>
                  <div className="flex flex-col items-end">
                    {tokenBalance !== null ? (
                      <>
                        <span 
                          className="text-2xl font-bold text-orange-600"
                          title={`${getFullTokenBalance(tokenBalance)} tokens`}
                        >
                          {formatTokenBalance(tokenBalance)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getFullTokenBalance(tokenBalance)}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-orange-600">...</span>
                    )}
                  </div>
                </div>
                <Link
                  href="/tokens"
                  onClick={() => setIsOpen(false)}
                  className="mt-2 block text-center text-xs font-medium text-orange-600 hover:text-orange-700 underline"
                >
                  Buy More Tokens
                </Link>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <Link
                href="/builder"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 px-6 py-3 hover:bg-orange-50 transition-colors"
              >
                <User className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Builder</span>
              </Link>

              <Link
                href="/search"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 px-6 py-3 hover:bg-orange-50 transition-colors"
              >
                <SearchIcon className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Search</span>
              </Link>

              <Link
                href="/generation"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 px-6 py-3 hover:bg-orange-50 transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Generation</span>
              </Link>

              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="w-full flex items-center gap-4 px-6 py-3 hover:bg-red-50 transition-colors border-t border-gray-200 text-left mt-2"
              >
                <LogOut className="w-5 h-5 text-red-500" />
                <span className="text-sm font-semibold text-red-600">Log Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
