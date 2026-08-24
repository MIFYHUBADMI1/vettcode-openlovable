"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Zap, Rocket, Crown } from "lucide-react";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import ButtonUI from "@/components/ui/shadcn/button";
import { Connector } from "@/components/shared/layout/curvy-rect";

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for trying out MirrorSite AI",
      icon: Zap,
      features: [
        "5 website clones per month",
        "Basic design styles",
        "Standard AI models",
        "Community support",
        "Code export"
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For professionals and small teams",
      icon: Rocket,
      features: [
        "Unlimited website clones",
        "All 8 design styles",
        "Premium AI models (GPT-4, Claude)",
        "Brand extension mode",
        "Priority support",
        "Advanced customization",
        "API access"
      ],
      cta: "Start Pro Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large teams and organizations",
      icon: Crown,
      features: [
        "Everything in Pro",
        "Custom AI model training",
        "Dedicated support",
        "SLA guarantee",
        "Custom integrations",
        "Team management",
        "White-label options"
      ],
      cta: "Contact Sales",
      popular: false,
    },
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
                Simple, Transparent Pricing
              </span>
            </h1>
            <p className="text-xl text-gray-600">
              Choose the plan that's right for you
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative rounded-2xl p-8 ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-500 shadow-xl' 
                    : 'bg-white border border-gray-200 shadow-lg'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${
                    plan.popular 
                      ? 'from-orange-500 to-red-500' 
                      : 'from-gray-400 to-gray-600'
                  } flex items-center justify-center mx-auto mb-4`}>
                    <plan.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <ButtonUI
                  className={`w-full py-3 rounded-full font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {plan.cta}
                </ButtonUI>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-center mt-16"
          >
            <p className="text-gray-600">
              All plans include code export and access to our community.{" "}
              <Link href="/about" className="text-orange-500 hover:text-orange-600 font-semibold">
                Learn more about our features →
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </HeaderProvider>
  );
}
