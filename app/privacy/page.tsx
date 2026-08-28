"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import UserMenu from "@/components/auth/UserMenu";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function PrivacyPage() {
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
                Privacy Policy
              </span>
            </h1>
            
            <div className="prose prose-lg max-w-none text-gray-700">
              <p className="text-sm text-gray-500 mb-8">
                Last updated: {new Date().toLocaleDateString()}
              </p>

              <p>
                At MirrorSite AI, operated by ATAI Enterprises, we take your privacy seriously. This Privacy Policy 
                explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">1. Information We Collect</h2>
              <h3 className="text-xl font-semibold mt-6 mb-3">Personal Information</h3>
              <p>
                We may collect personal information that you voluntarily provide to us when you:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Register for an account</li>
                <li>Use our services</li>
                <li>Contact us for support</li>
                <li>Subscribe to our newsletter</li>
              </ul>

              <h3 className="text-xl font-semibold mt-6 mb-3">Usage Information</h3>
              <p>
                We automatically collect certain information when you use MirrorSite AI, including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>URLs you input for cloning</li>
                <li>Generated website data</li>
                <li>Usage patterns and preferences</li>
                <li>Device and browser information</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">2. How We Use Your Information</h2>
              <p>
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your requests and transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Detect and prevent fraud and abuse</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">3. Information Sharing</h2>
              <p>
                We do not sell, trade, or rent your personal information to third parties. We may share your information with:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Providers:</strong> Third-party vendors who perform services on our behalf (e.g., Firecrawl for web scraping)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, sale, or acquisition</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">4. Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information. 
                However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">5. Third-Party Services</h2>
              <p>
                Our service uses third-party APIs and services:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Firecrawl:</strong> For website scraping and analysis</li>
                <li><strong>Groq, Google Gemini:</strong> For AI-powered code generation</li>
                <li><strong>E2B:</strong> For sandbox environments</li>
              </ul>
              <p>
                These services have their own privacy policies, and we encourage you to review them.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">6. Your Rights</h2>
              <p>
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of marketing communications</li>
                <li>Export your data</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">7. Cookies and Tracking</h2>
              <p>
                We use cookies and similar tracking technologies to track activity on our service and store certain information. 
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">8. Children's Privacy</h2>
              <p>
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal 
                information from children under 13.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">9. Changes to This Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the 
                new Privacy Policy on this page and updating the "Last updated" date.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">10. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="font-semibold">
                ATAI Enterprises<br />
                Email: privacy@atai-enterprises.com
              </p>

              <div className="mt-12 p-6 bg-orange-50 border border-orange-200 rounded-xl">
                <p className="text-sm text-gray-700">
                  By using MirrorSite AI, you consent to the collection and use of information in accordance with this Privacy Policy.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </HeaderProvider>
  );
}
