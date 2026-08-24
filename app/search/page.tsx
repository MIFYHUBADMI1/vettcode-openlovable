"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, Globe, ExternalLink, Sparkles, History, Clock } from "lucide-react";
import { toast } from "sonner";
import { appConfig } from '@/config/app.config';
import UserMenu from "@/components/auth/UserMenu";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import { Connector } from "@/components/shared/layout/curvy-rect";

interface SearchResult {
  url: string;
  title: string;
  description: string;
  screenshot: string | null;
  markdown: string;
}

interface SearchHistoryItem {
  query: string;
  lastSearched: string;
  searchCount: number;
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const response = await fetch('/api/search/history');
      if (response.ok) {
        const data = await response.json();
        setSearchHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const checkCachedResults = async (query: string): Promise<SearchResult[] | null> => {
    try {
      const response = await fetch(`/api/search/get?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.cached && data.results) {
          return data.results;
        }
      }
    } catch (error) {
      console.error('Failed to check cache:', error);
    }
    return null;
  };

  const saveSearchResults = async (query: string, results: SearchResult[]) => {
    try {
      await fetch('/api/search/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, results }),
      });
      // Reload history after saving
      loadSearchHistory();
    } catch (error) {
      console.error('Failed to save search results:', error);
    }
  };

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    
    // Check for cached results first
    const cachedResults = await checkCachedResults(query);
    
    if (cachedResults && cachedResults.length > 0) {
      setSearchResults(cachedResults);
      setIsSearching(false);
      toast.success(`Loaded ${cachedResults.length} cached results`, {
        description: "Results from previous search",
        icon: <Clock className="w-4 h-4" />,
      });
      return;
    }

    // Show searching toast
    const searchToast = toast.loading(`Searching for "${query}"...`, {
      description: "Finding the best websites for you",
    });

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        setSearchResults(results);
        
        // Save results to cache
        if (results.length > 0) {
          await saveSearchResults(query, results);
        }
        
        // Success toast
        toast.success(`Found ${results.length} results`, {
          id: searchToast,
          description: "Click on any website to clone it",
        });
      } else {
        toast.error("Search failed", {
          id: searchToast,
          description: "Please try again",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error("Search failed", {
        id: searchToast,
        description: "Please check your connection and try again",
      });
    } finally {
      setIsSearching(false);
    }
  }, []); // Empty deps - function is stable

  // Perform search on mount if query exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Update URL
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      performSearch(searchQuery);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    console.log('Clicked result:', result);
    
    toast.success("Preparing to clone...", {
      description: `${result.title}`,
    });

    try {
      // Store result and redirect to generation page
      sessionStorage.setItem('targetUrl', result.url);
      sessionStorage.setItem('selectedStyle', '1'); // Default style
      sessionStorage.setItem('selectedModel', appConfig.ai.defaultModel); // Use config default
      sessionStorage.setItem('autoStart', 'true');
      if (result.markdown) {
        sessionStorage.setItem('siteMarkdown', result.markdown);
      }
      
      console.log('Session storage set, redirecting to /generation');
      
      // Redirect to generation page where the cloning happens
      setTimeout(() => {
        console.log('Navigating to /generation');
        router.push('/generation');
      }, 500);
    } catch (error) {
      console.error('Error in handleResultClick:', error);
      toast.error("Failed to start cloning", {
        description: "Please try again",
      });
    }
  };

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base">
        {/* Header */}
        <HeaderDropdownWrapper />

        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />
          
          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[900px] mx-auto w-full flex justify-between items-center">
              <div className="flex gap-24 items-center">
                <Link href="/" className="flex items-center gap-3 group">
                  <Image 
                    src="/logo.png" 
                    alt="MirrorSite AI Logo" 
                    width={40} 
                    height={40}
                    className="rounded-lg"
                  />
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent"
                  >
                    MirrorSite AI
                  </motion.div>
                </Link>
              </div>

              <div className="flex items-center gap-6">
                <Link 
                  href="/about" 
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  About Us
                </Link>
                <Link 
                  href="/pricing" 
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  Pricing
                </Link>
                <UserMenu />
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Search Content */}
        <div className="container mx-auto px-16 py-16 max-w-6xl">
          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="text-4xl font-bold text-center mb-8">
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                Search Websites
              </span>
            </h1>

            <form onSubmit={handleSearch} className="max-w-3xl mx-auto relative">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  placeholder="Search for websites to clone..."
                  disabled={isSearching}
                  className="w-full pl-16 pr-32 py-6 text-lg border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Search
                    </>
                  )}
                </button>
              </div>

              {/* Search History Dropdown */}
              <AnimatePresence>
                {showHistory && searchHistory.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border-2 border-gray-200 overflow-hidden z-50"
                  >
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <History className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Recent Searches</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {searchHistory.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setSearchQuery(item.query);
                            setShowHistory(false);
                            performSearch(item.query);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900">{item.query}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{item.searchCount} {item.searchCount === 1 ? 'search' : 'searches'}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>

          {/* Loading State */}
          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="inline-block mb-6"
                >
                  <Sparkles className="w-16 h-16 text-orange-500" />
                </motion.div>
                <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                  Searching the web...
                </h3>
                <p className="text-gray-500">
                  Finding the best websites for "{searchQuery}"
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {!isSearching && hasSearched && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {searchResults.length > 0 ? (
                  <>
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-gray-600 mb-8 text-center"
                    >
                      Found <strong>{searchResults.length}</strong> results for "{searchQuery}"
                    </motion.p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {searchResults.map((result, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ y: -8, transition: { duration: 0.2 } }}
                          onClick={() => handleResultClick(result)}
                          className="bg-white rounded-xl border-2 border-gray-200 hover:border-orange-500 overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-xl group"
                        >
                          {result.screenshot ? (
                            <div className="relative h-48 bg-gray-100 overflow-hidden">
                              <Image
                                src={result.screenshot}
                                alt={result.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ) : (
                            <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <Globe className="w-16 h-16 text-gray-400" />
                            </div>
                          )}

                          <div className="p-6">
                            <h3 className="font-bold text-lg mb-2 text-gray-900 group-hover:text-orange-500 transition-colors line-clamp-2">
                              {result.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {result.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                {new URL(result.url).hostname}
                              </span>
                              <span className="text-sm font-semibold text-orange-500 group-hover:text-orange-600">
                                Clone →
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                      No results found
                    </h3>
                    <p className="text-gray-500 mb-8">
                      Try searching with different keywords
                    </p>
                    <Link href="/builder">
                      <ButtonUI className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3 rounded-lg">
                        Try Direct URL Instead
                      </ButtonUI>
                    </Link>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {!hasSearched && !isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center py-16"
            >
              <Sparkles className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                Start Your Search
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Search for any type of website you want to clone. We'll find the best matches for you!
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </HeaderProvider>
  );
}

// Wrap the component with Suspense boundary
export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-base flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading search...</p>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
