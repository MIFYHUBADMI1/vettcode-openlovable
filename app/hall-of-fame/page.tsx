"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ExternalLink, Trophy } from "lucide-react";
import { hallOfFameEntries, type HallOfFameEntry } from "@/lib/hall-of-fame-data";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import { Connector } from "@/components/shared/layout/curvy-rect";

function HallOfFameCard({ entry, index }: { entry: HallOfFameEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      viewport={{ once: true }}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-orange-300 transition-all duration-300"
    >
      {/* Screenshots — original on top, clone on bottom */}
      <div className="relative">
        {/* Original site */}
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          <Image
            src={entry.originalScreenshot}
            alt={`Original: ${entry.originalTitle}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 text-white text-[10px] font-medium rounded backdrop-blur-sm uppercase tracking-wider">
            Original
          </div>
        </div>

        {/* Clone */}
        <div className="relative h-48 bg-gray-50 overflow-hidden border-t border-gray-200">
          <Image
            src={entry.cloneScreenshot}
            alt={`Clone of ${entry.originalTitle}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute top-3 left-3 px-2 py-1 bg-orange-500 text-white text-[10px] font-medium rounded backdrop-blur-sm uppercase tracking-wider">
            Clone
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-gray-900 group-hover:text-orange-500 transition-colors">
            {entry.originalTitle}
          </h3>
          <a
            href={entry.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-orange-500 transition-colors flex-shrink-0 mt-0.5"
            title="Visit original site"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          {entry.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function HallOfFamePage() {
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
                <Link href="/" className="text-xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent hover:from-orange-600 hover:via-red-600 hover:to-pink-600 transition-all">
                  MirrorSite AI
                </Link>
              </div>
              <div className="flex items-center gap-6">
                <Link
                  href="/builder"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  Builder
                </Link>
                <Link
                  href="/pricing"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  Pricing
                </Link>
                <Link href="/builder">
                  <ButtonUI
                    variant="primary"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-2 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    Start Cloning
                  </ButtonUI>
                </Link>
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Content */}
        <div className="container mx-auto px-16 py-20 max-w-6xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-100 to-red-100 text-orange-600 text-sm font-medium mb-6 border border-orange-200">
              <Trophy className="w-4 h-4" />
              <span>Hall of Fame</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              The best clones built with{" "}
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                MirrorSite AI
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Real sites cloned into live, editable React + Tailwind code.
              Every entry here was generated in seconds — no dev team required.
            </p>
          </motion.div>

          {/* Gallery grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hallOfFameEntries.map((entry, index) => (
              <HallOfFameCard key={entry.id} entry={entry} index={index} />
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-20"
          >
            <p className="text-gray-600 mb-6">
              Think your clone deserves a spot?
            </p>
            <Link href="/builder">
              <ButtonUI
                variant="primary"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Clone something impressive
              </ButtonUI>
            </Link>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="py-12 bg-gray-900 text-white">
          <div className="container mx-auto px-16 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <span className="text-lg font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                MirrorSite AI
              </span>
              <div className="flex gap-6 text-sm text-gray-400">
                <Link href="/builder" className="hover:text-orange-400 transition-colors">
                  Builder
                </Link>
                <Link href="/pricing" className="hover:text-orange-400 transition-colors">
                  Pricing
                </Link>
                <Link href="/" className="hover:text-orange-400 transition-colors">
                  Home
                </Link>
              </div>
              <p className="text-gray-500 text-sm">
                Powered by <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 transition-colors">Firecrawl</a> • <strong>ATAI Enterprises</strong>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </HeaderProvider>
  );
}
