"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import UserMenu from "@/components/auth/UserMenu";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function TermsPage() {
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
                <Link href="/" className="flex items-center gap-2 group">
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

        {/* Content */}
        <div className="container mx-auto px-16 py-32 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                Terms of Service
              </span>
            </h1>
            
            <div className="prose prose-lg max-w-none text-gray-700">
              <p className="text-sm text-gray-500 mb-8">
                Last updated: {new Date().toLocaleDateString()}
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using MirrorSite AI ("the Service"), you accept and agree to be bound by the terms 
                and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">2. Use License</h2>
              <p>
                Permission is granted to temporarily use MirrorSite AI for personal, non-commercial transitory viewing only. 
                This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer any software contained on MirrorSite AI</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">3. Service Description</h2>
              <p>
                MirrorSite AI provides AI-powered website cloning and generation services. The Service allows users to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Clone existing website designs</li>
                <li>Generate new websites using AI</li>
                <li>Export generated code</li>
                <li>Customize design styles</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">4. User Responsibilities</h2>
              <p>
                Users are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Ensuring they have the right to clone any website they input</li>
                <li>Not using the Service to infringe on intellectual property rights</li>
                <li>Maintaining the security of their account credentials</li>
                <li>All activity that occurs under their account</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">5. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by ATAI Enterprises and are 
                protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">6. Limitation of Liability</h2>
              <p>
                In no event shall ATAI Enterprises or its suppliers be liable for any damages (including, without limitation, 
                damages for loss of data or profit, or due to business interruption) arising out of the use or inability to 
                use the Service.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">7. Privacy</h2>
              <p>
                Your use of MirrorSite AI is also governed by our Privacy Policy. Please review our{" "}
                <Link href="/privacy" className="text-orange-500 hover:text-orange-600 font-semibold">
                  Privacy Policy
                </Link>
                , which also governs the Service and informs users of our data collection practices.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">8. Changes to Terms</h2>
              <p>
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
                provide at least 30 days' notice prior to any new terms taking effect.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">9. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="font-semibold">
                ATAI Enterprises<br />
                Email: support@atai-enterprises.com
              </p>

              <div className="mt-12 p-6 bg-orange-50 border border-orange-200 rounded-xl">
                <p className="text-sm text-gray-700">
                  By using MirrorSite AI, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </HeaderProvider>
  );
}
