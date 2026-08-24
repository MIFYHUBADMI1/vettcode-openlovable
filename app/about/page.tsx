"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Building2, Users, Target, Zap } from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function AboutPage() {
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
                  className="px-4 py-2 text-sm font-medium text-orange-500 bg-orange-50 rounded-lg transition-all duration-200"
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

        {/* Content */}
        <div className="container mx-auto px-16 py-32 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                About Us
              </span>
            </h1>
            
            <div className="prose prose-lg max-w-none">
              <p className="text-xl text-gray-600 mb-8">
                MirrorSite AI is developed by <strong>ATAI Enterprises</strong> (Advanced Technologies and AI Enterprises), 
                the creators of VettCode.
              </p>

              <div className="grid md:grid-cols-2 gap-8 my-12">
                <div className="p-6 rounded-xl border border-gray-200 bg-white">
                  <Building2 className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">Our Company</h3>
                  <p className="text-gray-600">
                    ATAI Enterprises focuses on building cutting-edge AI-powered tools for developers and businesses.
                  </p>
                </div>

                <div className="p-6 rounded-xl border border-gray-200 bg-white">
                  <Target className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">Our Mission</h3>
                  <p className="text-gray-600">
                    To democratize web development through AI, making it accessible to everyone.
                  </p>
                </div>
              </div>

              <h2 className="text-3xl font-bold mt-12 mb-4">What We Do</h2>
              <p className="text-gray-600 mb-6">
                MirrorSite AI allows you to clone and reimagine any website in seconds using advanced AI technology. 
                Whether you're a developer looking for inspiration or a business wanting to quickly prototype designs, 
                our platform makes it simple and fast.
              </p>

              <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-8 my-12">
                <Zap className="w-12 h-12 text-orange-500 mb-4" />
                <h3 className="text-2xl font-bold mb-4">Powered by Industry Leaders</h3>
                <p className="text-gray-700">
                  Our platform leverages <strong>Firecrawl</strong> for accurate web scraping and supports multiple 
                  leading AI models including Claude, GPT-4, and Gemini to deliver the best results.
                </p>
              </div>

              <div className="mt-12 text-center">
                <Link href="/builder">
                  <ButtonUI 
                    variant="primary"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-full text-lg transition-all duration-300"
                  >
                    Try MirrorSite AI
                  </ButtonUI>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </HeaderProvider>
  );
}
