"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Search, Palette, Zap, Eye, Download, Globe, Code2, Layers, Rocket, Github } from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import GithubIcon from "@/components/shared/header/Github/_svg/GithubIcon";

// Import hero section components
import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import { BackgroundOuterPiece } from "@/components/app/(home)/sections/hero/Background/BackgroundOuterPiece";
import HomeHeroPixi from "@/components/app/(home)/sections/hero/Pixi/Pixi";
import { Connector } from "@/components/shared/layout/curvy-rect";
import HeroFlame from "@/components/shared/effects/flame/hero-flame";

export default function WelcomePage() {
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

        {/* Hero Section */}
        <section className="overflow-x-clip" id="home-hero">
          <div className="pt-28 lg:pt-254 lg:-mt-100 pb-115 relative" id="hero-content">
            <HomeHeroPixi />
            <HeroFlame />
            <BackgroundOuterPiece />
            <HomeHeroBackground />

            <div className="relative container px-16 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center"
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-100 to-red-100 text-orange-600 text-sm font-medium mb-8 border border-orange-200"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Welcome to MirrorSite AI</span>
                </motion.div>

                <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
                  <motion.span
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="block text-accent-black"
                  >
                    Clone Any Website
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="block bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent"
                  >
                    In Seconds
                  </motion.span>
                </h1>

                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto"
                >
                  Transform any website into your own with AI-powered design cloning.
                  Simply enter a URL or search for inspiration, and watch the magic happen.
                </motion.p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9, duration: 0.5 }}
                  >
                    <Link href="/builder">
                      <ButtonUI 
                        variant="primary"
                        className="text-lg px-8 py-6 h-auto rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        <Rocket className="w-5 h-5 mr-2" />
                        Get Started
                      </ButtonUI>
                    </Link>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                  >
                    <a href="#how-it-works">
                      <ButtonUI 
                        variant="tertiary"
                        className="text-lg px-8 py-6 h-auto rounded-full hover:bg-gray-100 transition-all duration-300"
                      >
                        Learn How It Works
                      </ButtonUI>
                    </a>
                  </motion.div>
                </div>

                {/* Powered by Firecrawl Badge */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.6 }}
                  className="flex justify-center"
                >
                  <a
                    href="https://firecrawl.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all duration-300 group"
                  >
                    <Zap className="w-4 h-4 group-hover:text-orange-500 transition-colors" />
                    <span>Powered by <strong className="font-semibold">Firecrawl</strong></span>
                  </a>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-32 bg-gray-50">
          <div className="container mx-auto px-16 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <h2 className="text-4xl lg:text-5xl font-bold text-accent-black mb-6">
                How It Works
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Three simple steps to clone any website with AI precision
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  step: "01",
                  title: "Enter URL or Search",
                  description: "Paste any website URL or search for inspiration. Our AI will analyze the design, layout, and styling.",
                  icon: Search,
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  step: "02",
                  title: "Choose Your Style",
                  description: "Select from 8 pre-built design styles or extend the brand's existing styles to create something new.",
                  icon: Palette,
                  color: "from-purple-500 to-pink-500",
                },
                {
                  step: "03",
                  title: "Generate & Deploy",
                  description: "Our AI generates production-ready code in seconds. Download, customize, or deploy instantly.",
                  icon: Zap,
                  color: "from-orange-500 to-red-500",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 group"
                >
                  <motion.div 
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <item.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <div className="text-sm font-bold text-orange-500 mb-2">
                    STEP {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-accent-black mb-4">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-32 bg-white">
          <div className="container mx-auto px-16 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <h2 className="text-4xl lg:text-5xl font-bold text-accent-black mb-6">
                Powerful Features
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Everything you need to clone and customize websites with AI
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "Web Scraping",
                  description: "Powered by Firecrawl for accurate website analysis and content extraction.",
                  icon: Globe,
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  title: "8 Design Styles",
                  description: "Choose from Glassmorphism, Neumorphism, Brutalism, Minimalist, and more.",
                  icon: Layers,
                  color: "from-purple-500 to-pink-500",
                },
                {
                  title: "Multiple AI Models",
                  description: "Support for Claude, GPT-4, Gemini, and other leading AI models.",
                  icon: Sparkles,
                  color: "from-indigo-500 to-purple-500",
                },
                {
                  title: "Brand Extension",
                  description: "Extract brand styles and use them to build completely new features.",
                  icon: Palette,
                  color: "from-pink-500 to-rose-500",
                },
                {
                  title: "Live Preview",
                  description: "See your generated website in real-time with instant updates.",
                  icon: Eye,
                  color: "from-green-500 to-emerald-500",
                },
                {
                  title: "Export Code",
                  description: "Download clean, production-ready code that you can customize.",
                  icon: Download,
                  color: "from-orange-500 to-red-500",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                  className="p-6 rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all duration-300 bg-white group"
                >
                  <motion.div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-accent-black mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 relative overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
          
          <div className="container mx-auto px-16 max-w-4xl text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <motion.h2 
                className="text-4xl lg:text-5xl font-bold text-white mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                Ready to Get Started?
              </motion.h2>
              <motion.p 
                className="text-xl text-white/90 mb-12 max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                Join thousands of developers who are building amazing websites with AI
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href="/builder">
                  <ButtonUI 
                    className="bg-white text-orange-600 hover:bg-gray-100 text-lg px-12 py-6 h-auto rounded-full font-bold shadow-2xl hover:shadow-3xl transition-all duration-300"
                  >
                    <Rocket className="w-5 h-5 mr-2" />
                    Start Building Now
                  </ButtonUI>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-16 bg-gray-900 text-white">
          <div className="container mx-auto px-16 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                  MirrorSite AI
                </span>
              </motion.div>
              <motion.div 
                className="flex gap-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <Link href="/builder" className="hover:text-orange-400 transition-colors flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  Builder
                </Link>
                <a 
                  href="https://github.com/mendableai/open-lovable"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-orange-400 transition-colors flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a 
                  href="https://firecrawl.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-orange-400 transition-colors flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Firecrawl
                </a>
              </motion.div>
              <motion.p 
                className="text-gray-400 text-sm"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
              >
                Powered by <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 transition-colors">Firecrawl</a> • <strong>ATAI Enterprises</strong>
              </motion.p>
            </div>
          </div>
        </footer>
      </div>
    </HeaderProvider>
  );
}
