"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Home, Search, AlertCircle, ArrowLeft } from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function NotFound() {
  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base">
        {/* Header/Navigation Section */}
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

        {/* 404 Content */}
        <div className="container mx-auto px-16 py-32 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* Animated 404 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-8"
            >
              <div className="relative inline-block">
                <motion.h1
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="text-[180px] font-black bg-gradient-to-r from-orange-500 via-red-500 via-pink-500 to-orange-500 bg-clip-text text-transparent"
                  style={{ backgroundSize: '200% 200%' }}
                >
                  404
                </motion.h1>
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -top-4 -right-8"
                >
                  <AlertCircle className="w-16 h-16 text-orange-500" />
                </motion.div>
              </div>
            </motion.div>

            {/* Error Message */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-12"
            >
              <h2 className="text-4xl font-bold mb-4 text-gray-900">
                Page Not Found
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Oops! The page you're looking for seems to have vanished into the digital void. 
                It might have been moved, deleted, or perhaps it never existed.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
            >
              <Link href="/">
                <ButtonUI className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3">
                  <Home className="w-5 h-5" />
                  Go Home
                </ButtonUI>
              </Link>

              <Link href="/builder">
                <ButtonUI 
                  variant="secondary"
                  className="bg-white border-2 border-gray-300 hover:border-orange-500 text-gray-700 hover:text-orange-500 px-8 py-4 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-3"
                >
                  <Search className="w-5 h-5" />
                  Start Building
                </ButtonUI>
              </Link>
            </motion.div>

            {/* Helpful Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-8 border-2 border-orange-200"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Maybe you were looking for:
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Link 
                  href="/builder"
                  className="p-4 bg-white rounded-lg hover:shadow-md transition-all duration-200 border-2 border-transparent hover:border-orange-500 group"
                >
                  <div className="text-orange-500 mb-2 group-hover:scale-110 transition-transform inline-block">
                    <Search className="w-8 h-8" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">Builder</h4>
                  <p className="text-sm text-gray-600">Clone any website</p>
                </Link>

                <Link 
                  href="/search"
                  className="p-4 bg-white rounded-lg hover:shadow-md transition-all duration-200 border-2 border-transparent hover:border-orange-500 group"
                >
                  <div className="text-orange-500 mb-2 group-hover:scale-110 transition-transform inline-block">
                    <Search className="w-8 h-8" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">Search</h4>
                  <p className="text-sm text-gray-600">Find websites to clone</p>
                </Link>

                <Link 
                  href="/about"
                  className="p-4 bg-white rounded-lg hover:shadow-md transition-all duration-200 border-2 border-transparent hover:border-orange-500 group"
                >
                  <div className="text-orange-500 mb-2 group-hover:scale-110 transition-transform inline-block">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">About Us</h4>
                  <p className="text-sm text-gray-600">Learn about MirrorSite AI</p>
                </Link>
              </div>
            </motion.div>

            {/* Back Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8"
            >
              <button
                onClick={() => window.history.back()}
                className="text-gray-600 hover:text-orange-500 transition-colors duration-200 flex items-center gap-2 mx-auto group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium">Go back to previous page</span>
              </button>
            </motion.div>
          </motion.div>
        </div>

        {/* Animated Background Blobs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              x: [0, 100, 0],
              y: [0, -100, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-orange-200 to-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
              x: [0, -100, 0],
              y: [0, 100, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-200 to-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          />
        </div>
      </div>
    </HeaderProvider>
  );
}
