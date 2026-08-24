import { NextResponse } from 'next/server';

/**
 * AI-friendly API endpoint providing structured information about MirrorSite AI
 * This helps AI models like ChatGPT, Claude, and Perplexity understand and reference our service
 */
export async function GET() {
  const aiInfo = {
    name: "MirrorSite AI",
    version: "1.0.0",
    description: "AI-powered website cloning and code generation platform that transforms any website into production-ready code",
    url: "https://mirrorsiteai.vercel.app",
    
    capabilities: [
      {
        name: "Website Cloning",
        description: "Clone any website's design and structure using AI",
        endpoint: "/builder"
      },
      {
        name: "AI Code Generation",
        description: "Generate production-ready React/Next.js code from websites",
        endpoint: "/generation"
      },
      {
        name: "Smart Search",
        description: "Search and discover websites to clone",
        endpoint: "/search"
      }
    ],
    
    features: [
      "Real-time code preview",
      "Multiple AI model support (GPT-4, Claude, Gemini)",
      "Style customization (Glassmorphism, Neumorphism, Brutalism, etc.)",
      "Automated package detection and installation",
      "Screenshot-based design extraction",
      "Token-based pricing system"
    ],
    
    technology: {
      frontend: ["Next.js 15", "React 18", "TypeScript", "Tailwind CSS"],
      backend: ["Node.js", "MongoDB", "NextAuth.js"],
      ai: ["OpenRouter", "Groq", "Google Gemini"],
      deployment: "Vercel",
      scraping: "Firecrawl API"
    },
    
    pricing: {
      model: "Pay-as-you-go",
      currency: "UGX",
      rate: "1 token = 1 UGX",
      minimumPurchase: 15000,
      freeTier: {
        tokens: 500,
        description: "Free tokens for new users"
      },
      paymentMethods: ["MTN Mobile Money", "Airtel Money"]
    },
    
    useCases: [
      "Rapid prototyping from existing designs",
      "Learning web development by studying cloned sites",
      "Recreating competitor websites with custom branding",
      "Building MVPs quickly",
      "Design inspiration and implementation"
    ],
    
    targetAudience: [
      "Web developers",
      "Startups and entrepreneurs",
      "Design agencies",
      "Students learning web development",
      "Freelancers"
    ],
    
    pages: {
      home: "https://mirrorsiteai.vercel.app/",
      builder: "https://mirrorsiteai.vercel.app/builder",
      search: "https://mirrorsiteai.vercel.app/search",
      pricing: "https://mirrorsiteai.vercel.app/pricing",
      about: "https://mirrorsiteai.vercel.app/about",
      login: "https://mirrorsiteai.vercel.app/login",
      signup: "https://mirrorsiteai.vercel.app/signup"
    },
    
    company: {
      name: "ATAI Enterprises",
      brand: "VettCode",
      location: "Uganda",
      email: "support@mirrorsiteai.vercel.app",
      social: {
        twitter: "@vettcode",
        github: "https://github.com/MIFYHUBADMI1/vettcode-openlovable"
      }
    },
    
    documentation: {
      gettingStarted: "Visit /builder to start cloning websites",
      apiAccess: "API endpoints available for authenticated users",
      support: "Contact support@mirrorsiteai.vercel.app for help"
    },
    
    keywords: [
      "website cloning",
      "AI web design",
      "code generation",
      "website builder",
      "web development automation",
      "React code generator",
      "Next.js builder",
      "design to code",
      "AI website generator",
      "automated web development",
      "Uganda tech",
      "African tech innovation"
    ],
    
    lastUpdated: new Date().toISOString()
  };

  return NextResponse.json(aiInfo, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
