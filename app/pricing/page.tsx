"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Coins, Calculator, Smartphone } from "lucide-react";
import { useState } from "react";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function PricingPage() {
  const [amount, setAmount] = useState("15000");

  // Calculate tokens from UGX amount (1 UGX = 1 token)
  const calculateTokens = (ugx: string) => {
    const value = parseInt(ugx) || 0;
    return value;
  };

  const suggestedAmounts = [
    { label: "15K UGX", value: "15000", tokens: "15,000" },
    { label: "50K UGX", value: "50000", tokens: "50,000" },
    { label: "100K UGX", value: "100000", tokens: "100,000" },
    { label: "500K UGX", value: "500000", tokens: "500,000" },
  ];

  const features = [
    "Pay only for what you use",
    "No monthly subscriptions",
    "No hidden fees",
    "Tokens never expire",
    "Instant activation",
    "Secure mobile money payments",
    "MTN & Airtel supported",
    "AI-powered payment verification"
  ];

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
                  className="px-4 py-2 text-sm font-medium text-orange-500 bg-orange-50 rounded-lg transition-all duration-200"
                >
                  Pricing
                </Link>
                <Link 
                  href="/login" 
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  Login
                </Link>
                <Link href="/signup">
                  <ButtonUI 
                    variant="primary"
                    className="ml-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-2.5 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    Sign Up
                  </ButtonUI>
                </Link>
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Content */}
        <div className="container mx-auto px-16 py-32 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                Simple Token-Based Pricing
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-4">
              Pay as you go - No subscriptions, no commitments
            </p>
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 px-4 py-2 rounded-full">
              <span className="text-green-600 font-semibold">🎉 New users get 500 FREE tokens!</span>
            </div>
          </motion.div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Token Calculator */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-2xl p-8 shadow-xl border-2 border-orange-500"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4">
                  <Calculator className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Token Calculator</h2>
                <p className="text-gray-600 text-sm">Calculate how many tokens you'll get</p>
              </div>

              <div className="space-y-6">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Enter Amount (UGX)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="15000"
                    step="1000"
                    className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="15000"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum: 15,000 UGX</p>
                </div>

                {/* Quick Amount Buttons */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quick Select
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedAmounts.map((suggestion) => (
                      <button
                        key={suggestion.value}
                        onClick={() => setAmount(suggestion.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          amount === suggestion.value
                            ? "bg-orange-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">You will receive</p>
                    <div className="flex items-center justify-center gap-2">
                      <Coins className="w-8 h-8 text-orange-500" />
                      <span className="text-4xl font-bold text-orange-600">
                        {calculateTokens(amount).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-gray-700 mt-2">tokens</p>
                    <p className="text-xs text-gray-500 mt-3">
                      1 token = 1 UGX • Simple & transparent
                    </p>
                  </div>
                </div>

                <Link href="/tokens" className="block">
                  <ButtonUI className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                    Buy Tokens Now 🚀
                  </ButtonUI>
                </Link>
              </div>
            </motion.div>

            {/* Features & Payment Methods */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* Features */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <Coins className="w-6 h-6 text-orange-500" />
                  <h3 className="text-xl font-bold">What You Get</h3>
                </div>
                <ul className="space-y-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payment Methods */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 shadow-lg border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-6">
                  <Smartphone className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-purple-900">Mobile Money</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center font-bold text-black">
                      MTN
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">MTN Mobile Money</p>
                      <p className="text-sm text-gray-600">Instant verification</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center font-bold text-white">
                      Airtel
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Airtel Money</p>
                      <p className="text-sm text-gray-600">Instant verification</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Send to:</span> +256 761 819 885
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      <span className="font-semibold">Name:</span> Biira Keziah
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Upload screenshot for instant verification
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <h3 className="font-bold text-lg mb-2">How are tokens used?</h3>
                <p className="text-gray-600">
                  Tokens are consumed based on the complexity and size of the website you're cloning. 
                  Simple websites may use 10,000-50,000 tokens, while complex sites may require 100,000-500,000 tokens.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <h3 className="font-bold text-lg mb-2">Do tokens expire?</h3>
                <p className="text-gray-600">
                  No! Your tokens never expire. Buy once and use them whenever you're ready.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <h3 className="font-bold text-lg mb-2">What's the minimum purchase?</h3>
                <p className="text-gray-600">
                  The minimum purchase is 15,000 UGX (15,000 tokens), which is enough for several simple website clones.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
                <h3 className="font-bold text-lg mb-2">How does payment verification work?</h3>
                <p className="text-gray-600">
                  After making your mobile money payment, upload a screenshot of the confirmation. 
                  Our AI instantly verifies the payment and credits your tokens within seconds.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </HeaderProvider>
  );
}
