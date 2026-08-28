"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Head from "next/head";
import { 
  Check, 
  Coins, 
  Calculator, 
  Shield, 
  Lock, 
  Zap, 
  Star,
  Award,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useState, useEffect } from "react";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import UserMenu from "@/components/auth/UserMenu";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function PricingPage() {
  const [amount, setAmount] = useState("15000");

  // SEO optimization - Update document head
  useEffect(() => {
    document.title = "Pricing - Professional Token Packages | MirrorSite AI";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Transparent, pay-as-you-go pricing for website cloning. 1 token = 1 UGX. Minimum 15,000 UGX. Enterprise-grade security. Tokens never expire. Get 500 free tokens.');
    }
  }, []);

  // Calculate tokens from UGX amount (1 UGX = 1 token)
  const calculateTokens = (ugx: string) => {
    const value = parseInt(ugx) || 0;
    return value;
  };

  const suggestedAmounts = [
    { label: "15K UGX", value: "15000", tokens: "15,000", popular: false },
    { label: "50K UGX", value: "50000", tokens: "50,000", popular: true },
    { label: "100K UGX", value: "100000", tokens: "100,000", popular: false },
    { label: "500K UGX", value: "500000", tokens: "500,000", popular: false },
  ];

  const features = [
    { icon: Zap, text: "Pay only for what you use", desc: "No monthly subscriptions or hidden fees" },
    { icon: Shield, text: "Bank-grade security", desc: "256-bit encryption protects all transactions" },
    { icon: CheckCircle2, text: "No hidden fees", desc: "Transparent pricing with no surprises" },
    { icon: Clock, text: "Tokens never expire", desc: "Use your tokens whenever you're ready" },
    { icon: TrendingUp, text: "Instant activation", desc: "Tokens credited within 30 seconds" },
    { icon: Sparkles, text: "AI-powered platform", desc: "Advanced technology for perfect results" }
  ];

  const trustIndicators = [
    { icon: Users, value: "1,000+", label: "Active Users" },
    { icon: CheckCircle2, value: "99.9%", label: "Uptime" },
    { icon: Shield, value: "256-bit", label: "Encryption" },
    { icon: Zap, value: "<30s", label: "Verification" }
  ];

  const testimonials = [
    {
      name: "Sarah K.",
      role: "Freelance Developer",
      content: "MirrorSite AI helped me clone a client's site in minutes. The token system is transparent and affordable!",
      rating: 5
    },
    {
      name: "David M.",
      role: "Startup Founder",
      content: "Fast, secure, and reliable. The mobile money integration works flawlessly with instant verification.",
      rating: 5
    },
    {
      name: "Grace N.",
      role: "Web Designer",
      content: "I love the pay-as-you-go model. No subscriptions, no commitments. Just buy tokens when I need them.",
      rating: 5
    }
  ];

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
        {/* Header/Navigation Section */}
        <HeaderDropdownWrapper />

        <div className="sticky top-0 left-0 w-full z-[101] bg-white/80 backdrop-blur-lg border-b border-gray-200 header shadow-sm">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          
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
                <UserMenu />
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Hero Section with Trust Indicators */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-16 py-12 sm:py-16 lg:py-24 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            {/* Security Badge */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-3 bg-green-50 border-2 border-green-300 px-8 py-4 rounded-full mb-8 shadow-md"
            >
              <Shield className="w-8 h-8 lg:w-10 lg:h-10 text-green-600" />
              <span className="text-green-700 font-semibold text-lg lg:text-xl">Secure & Verified Payment System</span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                Professional Token Pricing
              </span>
              <br />
              <span className="text-gray-800">Built for Developers</span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Enterprise-grade website cloning with transparent, pay-as-you-go pricing. 
              No subscriptions. No hidden fees. Just simple, secure token purchases.
            </p>

            {/* Free Tokens Badge */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="inline-flex items-center gap-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-10 py-5 rounded-full shadow-xl text-lg lg:text-xl font-bold"
            >
              <Award className="w-8 h-8 lg:w-10 lg:h-10" />
              <span>🎉 New users get 500 FREE tokens instantly!</span>
            </motion.div>
          </motion.div>

          {/* Trust Indicators Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20 max-w-6xl mx-auto"
          >
            {trustIndicators.map((indicator, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05, y: -8 }}
                className="bg-white rounded-3xl p-10 lg:p-12 shadow-2xl border-2 border-gray-200 text-center hover:border-orange-300 transition-all"
              >
                <indicator.icon className="w-20 h-20 lg:w-24 lg:h-24 text-orange-500 mx-auto mb-6" />
                <div className="text-5xl lg:text-6xl font-black text-gray-800 mb-4">{indicator.value}</div>
                <div className="text-lg lg:text-xl text-gray-600 font-semibold">{indicator.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Content Grid */}
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 mb-20">
            {/* Token Calculator - Enhanced for Desktop */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-3xl p-10 lg:p-12 shadow-2xl border-4 border-orange-400 relative overflow-hidden"
            >
              {/* Decorative gradient overlay */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-100 to-transparent rounded-full -mr-48 -mt-48 opacity-50" />
              
              <div className="relative z-10">
                <div className="text-center mb-10">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="w-28 h-28 lg:w-36 lg:h-36 rounded-3xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center mx-auto mb-8 shadow-2xl"
                  >
                    <Calculator className="w-16 h-16 lg:w-20 lg:h-20 text-white" />
                  </motion.div>
                  <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-gray-800">Token Calculator</h2>
                  <p className="text-xl lg:text-2xl text-gray-600">Calculate your investment</p>
                  
                  {/* Security indicator */}
                  <div className="mt-8 inline-flex items-center gap-4 bg-blue-50 border-2 border-blue-200 px-8 py-4 rounded-full">
                    <Lock className="w-8 h-8 text-blue-600" />
                    <span className="text-lg text-blue-700 font-bold">256-bit Encrypted</span>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Amount Input */}
                  <div>
                    <label className="block text-xl font-bold text-gray-700 mb-5 flex items-center gap-4">
                      <Coins className="w-9 h-9 text-orange-500" />
                      Enter Amount (UGX)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="15000"
                        step="1000"
                        className="w-full px-8 py-8 text-3xl lg:text-4xl font-bold border-3 border-gray-300 rounded-3xl focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all bg-gray-50"
                        placeholder="15000"
                      />
                      <div className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-2xl">
                        UGX
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3 text-base text-gray-600">
                      <AlertCircle className="w-6 h-6" />
                      <span>Minimum purchase: 15,000 UGX</span>
                    </div>
                  </div>

                  {/* Quick Amount Buttons */}
                  <div>
                    <label className="block text-lg font-bold text-gray-700 mb-4">
                      Quick Select
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {suggestedAmounts.map((suggestion) => (
                        <motion.button
                          key={suggestion.value}
                          onClick={() => setAmount(suggestion.value)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`relative px-6 py-5 rounded-2xl text-lg font-bold transition-all ${
                            amount === suggestion.value
                              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-xl"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-200"
                          }`}
                        >
                          {suggestion.popular && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-3 py-1 rounded-full">
                              Popular
                            </span>
                          )}
                          {suggestion.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Result Display - Enhanced */}
                  <motion.div
                    animate={{ boxShadow: ["0 0 0 0 rgba(249, 115, 22, 0)", "0 0 0 10px rgba(249, 115, 22, 0)"] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 rounded-3xl p-12 border-3 border-orange-300 shadow-2xl"
                  >
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-600 mb-6 uppercase tracking-wider">
                        You Will Receive
                      </p>
                      <div className="flex items-center justify-center gap-5 mb-6">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        >
                          <Coins className="w-20 h-20 lg:w-24 lg:h-24 text-orange-500" />
                        </motion.div>
                        <span className="text-7xl lg:text-8xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                          {calculateTokens(amount).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-4xl font-bold text-gray-800 mb-8">Tokens</p>
                      <div className="bg-white rounded-2xl p-6 border-2 border-orange-200">
                        <p className="text-base text-gray-600 font-medium">
                          <span className="text-orange-600 font-bold text-2xl">1 token = 1 UGX</span>
                          <br />
                          Simple • Transparent • No Hidden Costs
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* CTA Button - Enhanced */}
                  <Link href="/tokens" className="block">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ButtonUI className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white py-8 rounded-3xl font-bold text-2xl lg:text-3xl shadow-2xl hover:shadow-3xl transition-all relative overflow-hidden group cursor-pointer">
                        <span className="relative z-10 flex items-center justify-center gap-4">
                          <Lock className="w-9 h-9" />
                          Buy Tokens Securely
                          <ArrowRight className="w-9 h-9 group-hover:translate-x-2 transition-transform" />
                        </span>
                        <motion.div
                          className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      </ButtonUI>
                    </motion.div>
                  </Link>

                  {/* Trust badges under button */}
                  <div className="flex items-center justify-center gap-8 text-lg text-gray-600">
                    <div className="flex items-center gap-3">
                      <Shield className="w-8 h-8 text-green-500" />
                      <span className="font-bold">Secure</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-blue-500" />
                      <span className="font-bold">Verified</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Zap className="w-8 h-8 text-yellow-500" />
                      <span className="font-bold">Instant</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Features List - Enhanced */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-3xl p-10 lg:p-12 shadow-2xl border-2 border-gray-200"
            >
              <div className="flex items-center gap-5 mb-10">
                <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Award className="w-11 h-11 lg:w-14 lg:h-14 text-white" />
                </div>
                <h3 className="text-4xl lg:text-5xl font-bold text-gray-800">Premium Features</h3>
              </div>
              <ul className="space-y-6">
                {features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="group hover:bg-gray-50 p-4 rounded-2xl transition-all"
                  >
                    <div className="flex items-start gap-5">
                      <div className="w-16 h-16 lg:w-18 lg:h-18 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-md">
                        <feature.icon className="w-9 h-9 lg:w-10 lg:h-10 text-green-600" />
                      </div>
                      <div>
                        <span className="text-gray-900 font-bold text-xl lg:text-2xl block mb-2">{feature.text}</span>
                        <span className="text-gray-600 text-base">{feature.desc}</span>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>

              {/* Additional Trust Section */}
              <div className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-10 h-10 text-blue-600" />
                  <h4 className="text-2xl font-bold text-blue-900">Why Choose Us?</h4>
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  We use bank-grade 256-bit encryption to protect your data. Our AI-powered payment 
                  verification system processes payments instantly, and your tokens never expire. 
                  Join 1,000+ developers who trust MirrorSite AI.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Social Proof - Testimonials */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mb-20"
          >
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-6">
                Trusted by Developers Worldwide
              </h2>
              <p className="text-gray-600 text-xl">
                See what our users are saying about MirrorSite AI
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + (index * 0.1) }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  className="bg-white rounded-3xl p-10 shadow-2xl border-2 border-gray-200 relative hover:border-orange-300 transition-all"
                >
                  {/* Star rating */}
                  <div className="flex gap-2 mb-8">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-8 h-8 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  {/* Quote */}
                  <p className="text-gray-700 mb-8 italic text-xl leading-relaxed">"{testimonial.content}"</p>
                  
                  {/* Author */}
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-xl">{testimonial.name}</p>
                      <p className="text-lg text-gray-600">{testimonial.role}</p>
                    </div>
                  </div>
                  
                  {/* Verified badge */}
                  <div className="absolute top-8 right-8">
                    <div className="bg-green-100 p-3 rounded-full shadow-md">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* FAQ Section - Enhanced */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="max-w-5xl mx-auto"
          >
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-6">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-600 text-xl">
                Everything you need to know about our token system
              </p>
            </div>

            <div className="space-y-8">
              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white rounded-3xl p-12 shadow-2xl border-2 border-gray-200 hover:border-orange-300 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-orange-600 font-black text-3xl">?</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-3xl mb-5 text-gray-800">How are tokens used?</h3>
                    <p className="text-gray-600 leading-relaxed text-xl">
                      Tokens are consumed based on the complexity and size of the website you're cloning. 
                      Simple websites may use 10,000-50,000 tokens, while complex sites may require 100,000-500,000 tokens. 
                      Our AI calculates the exact requirement before starting.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white rounded-3xl p-12 shadow-2xl border-2 border-gray-200 hover:border-orange-300 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Clock className="w-11 h-11 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-3xl mb-5 text-gray-800">Do tokens expire?</h3>
                    <p className="text-gray-600 leading-relaxed text-xl">
                      <span className="font-bold text-green-600 text-2xl">Never!</span> Your tokens are yours forever. 
                      Buy once and use them whenever you're ready. No time pressure, no expiration dates.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white rounded-3xl p-12 shadow-2xl border-2 border-gray-200 hover:border-orange-300 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Coins className="w-11 h-11 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-3xl mb-5 text-gray-800">What's the minimum purchase?</h3>
                    <p className="text-gray-600 leading-relaxed text-xl">
                      The minimum purchase is <span className="font-bold text-orange-600 text-2xl">15,000 UGX (15,000 tokens)</span>, 
                      which is enough for several simple website clones or testing the platform.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white rounded-3xl p-12 shadow-2xl border-2 border-gray-200 hover:border-orange-300 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Shield className="w-11 h-11 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-3xl mb-5 text-gray-800">How does payment verification work?</h3>
                    <p className="text-gray-600 leading-relaxed text-xl">
                      After making your mobile money payment, upload a screenshot of the confirmation. 
                      Our <span className="font-bold text-purple-600 text-2xl">AI-powered verification system</span> instantly 
                      analyzes the payment details and credits your tokens within 30 seconds. Secure, fast, and reliable.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white rounded-3xl p-12 shadow-2xl border-2 border-gray-200 hover:border-orange-300 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Lock className="w-11 h-11 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-3xl mb-5 text-gray-800">Is my payment information secure?</h3>
                    <p className="text-gray-600 leading-relaxed text-xl">
                      Absolutely! We use <span className="font-bold text-red-600 text-2xl">256-bit encryption</span> and 
                      never store your payment credentials. All transactions are processed through trusted mobile money 
                      providers (MTN and Airtel). Your security is our top priority.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Final CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="mt-24 text-center"
          >
            <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-3xl p-16 lg:p-20 shadow-2xl relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -ml-48 -mt-48 opacity-10" />
              <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white rounded-full -mr-64 -mb-64 opacity-10" />
              
              <div className="relative z-10">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="inline-block mb-10"
                >
                  <Award className="w-28 h-28 lg:w-32 lg:h-32 text-white mx-auto drop-shadow-2xl" />
                </motion.div>
                
                <h2 className="text-5xl lg:text-7xl font-bold text-white mb-8">
                  Ready to Get Started?
                </h2>
                <p className="text-2xl lg:text-3xl text-white/95 mb-16 max-w-3xl mx-auto leading-relaxed">
                  Join thousands of developers who trust MirrorSite AI for professional website cloning. 
                  Get 500 free tokens when you sign up today!
                </p>
                
                <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
                  <Link href="/signup">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ButtonUI className="bg-white text-orange-600 hover:bg-gray-100 px-16 py-8 rounded-3xl font-bold text-3xl shadow-2xl flex items-center gap-4">
                        <Sparkles className="w-10 h-10" />
                        Sign Up for Free
                      </ButtonUI>
                    </motion.div>
                  </Link>
                  
                  <Link href="/tokens">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ButtonUI className="bg-transparent border-4 border-white text-white hover:bg-white/10 px-16 py-8 rounded-3xl font-bold text-3xl flex items-center gap-4">
                        <Coins className="w-10 h-10" />
                        Buy Tokens Now
                      </ButtonUI>
                    </motion.div>
                  </Link>
                </div>

                {/* Trust badges */}
                <div className="mt-16 flex flex-wrap justify-center items-center gap-10 text-white/90 text-xl font-semibold">
                  <div className="flex items-center gap-4">
                    <Shield className="w-9 h-9" />
                    <span>Bank-Grade Security</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="w-9 h-9" />
                    <span>Verified Payments</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Zap className="w-9 h-9" />
                    <span>Instant Activation</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Users className="w-9 h-9" />
                    <span>1,000+ Happy Users</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </HeaderProvider>
  );
}
