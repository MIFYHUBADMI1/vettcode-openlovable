"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Link2,
  ScanLine,
  LayoutDashboard,
  Pencil,
  ArrowRight,
  Play,
  Globe,
  Palette,
  Building2,
  Code2,
  Github,
  Trophy,
  Zap,
} from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";

// Import shared components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import { Connector } from "@/components/shared/layout/curvy-rect";

// ─── YouTube Video ID Configuration ─────────────────────────────────────────
// Replace YOUR_VIDEO_ID_HERE with your actual YouTube video ID.
// Example: if your URL is https://www.youtube.com/watch?v=dQw4w9WgXcQ
// then your video ID is: dQw4w9WgXcQ
const YOUTUBE_VIDEO_ID = "YOUR_VIDEO_ID_HERE";
// ─────────────────────────────────────────────────────────────────────────────

// ─── Animation Variants ─────────────────────────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

// ─── Background Wireframe Pattern ───────────────────────────────────────────
function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Subtle grid lines suggesting website structure */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="heroGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#heroGrid)" />
      </svg>

      {/* Faint scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/20 to-transparent"
        initial={{ top: "10%" }}
        animate={{ top: ["10%", "90%", "10%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Abstract component outlines */}
      <div className="absolute top-[15%] left-[5%] w-[180px] h-[120px] border border-orange-500/[0.06] rounded-lg hidden lg:block" />
      <div className="absolute top-[20%] right-[8%] w-[140px] h-[90px] border border-pink-500/[0.06] rounded-lg hidden lg:block" />
      <div className="absolute bottom-[25%] left-[10%] w-[200px] h-[60px] border border-red-500/[0.06] rounded-md hidden lg:block" />
      <div className="absolute bottom-[30%] right-[12%] w-[120px] h-[120px] border border-orange-400/[0.06] rounded-xl hidden lg:block" />

      {/* Soft radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-orange-500/[0.04] to-transparent rounded-full blur-3xl" />
    </div>
  );
}

// ─── YouTube Embed ──────────────────────────────────────────────────────────
function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  if (videoId === "YOUR_VIDEO_ID_HERE") {
    return (
      <div className="relative w-full aspect-video bg-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden">
        <div className="text-center p-8">
          <Play className="w-16 h-16 text-orange-500/40 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">Video Demo Coming Soon</p>
          <p className="text-gray-400 text-sm mt-2">
            Replace YOUR_VIDEO_ID_HERE in app/page.tsx with your YouTube video ID
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200/60 shadow-2xl bg-black">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}

// ─── Step Icon Component ────────────────────────────────────────────────────
function StepIcon({ icon: Icon, step }: { icon: typeof Link2; step: number }) {
  const colors = [
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-pink-500",
    "from-orange-500 to-red-500",
    "from-pink-500 to-rose-500",
  ];
  return (
    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors[step - 1]} flex items-center justify-center shadow-lg`}>
      <Icon className="w-7 h-7 text-white" />
    </div>
  );
}

// ─── Use Case Card ──────────────────────────────────────────────────────────
function UseCaseCard({
  title,
  description,
  icon: Icon,
  gradient,
  index,
}: {
  title: string;
  description: string;
  icon: typeof Globe;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      variants={scaleIn}
      custom={index}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
      className="group relative bg-white rounded-2xl p-8 border border-gray-100 hover:border-orange-200 shadow-sm hover:shadow-xl transition-all duration-300"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────
export default function WelcomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [videoId, setVideoId] = useState(YOUTUBE_VIDEO_ID);

  const handlePrimaryCta = () => {
    router.push(status === "authenticated" && session ? "/builder" : "/signup");
  };

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base">
        {/* ─── Navigation ─────────────────────────────────────── */}
        <HeaderDropdownWrapper />

        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />

          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[1100px] mx-auto w-full flex justify-between items-center">
              <div className="flex items-center">
                <Link href="/" className="flex items-center gap-3 group">
                  <Image
                    src="/logo.png"
                    alt="MirrorSite AI Logo"
                    width={36}
                    height={36}
                    className="rounded-lg"
                  />
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className="text-xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent"
                  >
                    MirrorSite AI
                  </motion.span>
                </Link>
              </div>

              <div className="hidden md:flex items-center gap-1">
                <Link
                  href="#how-it-works"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  How It Works
                </Link>
                <Link
                  href="/pricing"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  Pricing
                </Link>
                <div className="ml-4">
                  <UserMenu />
                </div>
              </div>

              {/* Mobile menu button */}
              <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Menu">
                <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </HeaderWrapper>
        </div>

        {/* ─── Hero Section ───────────────────────────────────── */}
        <section className="overflow-x-clip relative" id="home-hero">
          <div className="pt-24 lg:pt-28 pb-20 lg:pb-28 relative" id="hero-content">
            <HeroBackground />

            <div className="relative container px-16 max-w-5xl mx-auto">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="text-center"
              >
                {/* Eyebrow badge */}
                <motion.div
                  variants={scaleIn}
                  custom={0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-50 to-red-50 text-orange-600 text-sm font-semibold mb-8 border border-orange-200/60"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>TURN WEBSITE INSPIRATION INTO A PROJECT</span>
                </motion.div>

                {/* Main headline */}
                <motion.h1
                  variants={fadeInUp}
                  custom={1}
                  className="text-[2.75rem] sm:text-[3.25rem] lg:text-[4rem] font-bold mb-6 leading-[1.1] tracking-tight"
                >
                  <span className="block text-gray-900">See a website you like?</span>
                  <span className="block bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                    Turn it into your starting point.
                  </span>
                </motion.h1>

                {/* Supporting description */}
                <motion.p
                  variants={fadeInUp}
                  custom={2}
                  className="text-lg sm:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed"
                >
                  Paste a public website URL. MirrorSite AI analyzes its layout and
                  structure, then recreates it as an editable starting point you can
                  customize and make your own.
                </motion.p>

                {/* Primary & Secondary CTAs */}
                <motion.div
                  variants={fadeInUp}
                  custom={3}
                  className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
                >
                  <motion.button
                    type="button"
                    onClick={handlePrimaryCta}
                    whileHover={{ scale: 1.04, boxShadow: "0 8px 30px rgba(249, 115, 22, 0.3)" }}
                    whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-lg transition-all duration-300 shadow-lg cursor-pointer"
                    >
                      <Sparkles className="w-5 h-5" />
                      Try your first site free
                    </motion.button>
                  <a href="#product-demo">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full border-2 border-gray-200 hover:border-orange-300 text-gray-700 font-semibold text-lg transition-all duration-300 hover:bg-orange-50 cursor-pointer"
                    >
                      <Play className="w-5 h-5 text-orange-500" />
                      Watch how it works
                    </motion.button>
                  </a>
                </motion.div>

                {/* Trust text */}
                <motion.p
                  variants={fadeInUp}
                  custom={4}
                  className="text-sm text-gray-400"
                >
                  No credit card required · Start in minutes
                </motion.p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── Product Demo Section ───────────────────────────── */}
        <section id="product-demo" className="py-20 lg:py-28 bg-gray-50/50">
          <div className="container mx-auto px-16 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-5">
                See MirrorSite AI in action.
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Watch how a website goes from a simple URL to an editable starting
                point in just a few steps.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              viewport={{ once: true, margin: "-50px" }}
              className="max-w-4xl mx-auto"
            >
              <YouTubeEmbed videoId={videoId} title="MirrorSite AI Product Demo" />
            </motion.div>
          </div>
        </section>

        {/* ─── How It Works Section ───────────────────────────── */}
        <section id="how-it-works" className="py-20 lg:py-28 bg-white">
          <div className="container mx-auto px-16 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16 lg:mb-20"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-5">
                From inspiration to your own project.
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Start with a website you admire. MirrorSite AI helps you understand,
                recreate, and transform it into something you can build on.
              </p>
            </motion.div>

            {/* Desktop: Horizontal steps with arrows */}
            <div className="hidden lg:flex items-start justify-between gap-6 max-w-5xl mx-auto">
              {[
                {
                  step: 1,
                  icon: Link2,
                  title: "Paste a URL",
                  text: "Paste the URL of a public website you want to use as inspiration.",
                },
                {
                  step: 2,
                  icon: ScanLine,
                  title: "MirrorSite Analyzes",
                  text: "MirrorSite AI analyzes the layout, sections, and overall structure.",
                },
                {
                  step: 3,
                  icon: LayoutDashboard,
                  title: "Editable Starting Point",
                  text: "Get a recreated project you can explore, edit, and build upon.",
                },
                {
                  step: 4,
                  icon: Pencil,
                  title: "Make It Yours",
                  text: "Change the content, branding, design, and direction to create something uniquely yours.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  viewport={{ once: true }}
                  className="flex-1 relative"
                >
                  <div className="flex items-center gap-4 mb-5">
                    <StepIcon icon={item.icon} step={item.step} />
                    <span className="text-xs font-bold text-orange-500 tracking-wider">
                      STEP {String(item.step).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{item.text}</p>

                  {/* Arrow connector */}
                  {i < 3 && (
                    <div className="absolute top-6 -right-4 lg:-right-6 z-10">
                      <ArrowRight className="w-5 h-5 text-orange-400/50" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Mobile: Vertical steps */}
            <div className="lg:hidden space-y-8">
              {[
                {
                  step: 1,
                  icon: Link2,
                  title: "Paste a URL",
                  text: "Paste the URL of a public website you want to use as inspiration.",
                },
                {
                  step: 2,
                  icon: ScanLine,
                  title: "MirrorSite Analyzes",
                  text: "MirrorSite AI analyzes the layout, sections, and overall structure.",
                },
                {
                  step: 3,
                  icon: LayoutDashboard,
                  title: "Editable Starting Point",
                  text: "Get a recreated project you can explore, edit, and build upon.",
                },
                {
                  step: 4,
                  icon: Pencil,
                  title: "Make It Yours",
                  text: "Change the content, branding, design, and direction to create something uniquely yours.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-5"
                >
                  <div className="flex flex-col items-center">
                    <StepIcon icon={item.icon} step={item.step} />
                    {i < 3 && (
                      <div className="flex-1 w-[2px] bg-gradient-to-b from-orange-200 to-transparent mt-3" />
                    )}
                  </div>
                  <div className="pb-4">
                    <span className="text-xs font-bold text-orange-500 tracking-wider">
                      STEP {String(item.step).padStart(2, "0")}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1 mb-2">{item.title}</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">{item.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Use Cases / Product Proof Section ──────────────── */}
        <section className="py-20 lg:py-28 bg-gray-50/50">
          <div className="container mx-auto px-16 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-5">
                See what MirrorSite AI can become.
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Start with inspiration and transform the structure into something
                completely your own.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <UseCaseCard
                title="A SaaS Landing Page"
                description="Start with inspiration and adapt the structure for your product. Customize the layout, messaging, and branding to match your vision."
                icon={Globe}
                gradient="from-blue-500 to-cyan-500"
                index={0}
              />
              <UseCaseCard
                title="A Portfolio"
                description="Transform a layout into a personal portfolio that reflects your own work. Showcase projects, skills, and experience your way."
                icon={Palette}
                gradient="from-purple-500 to-pink-500"
                index={1}
              />
              <UseCaseCard
                title="A Business Website"
                description="Rework the structure, content, and branding for a completely different business. Create a professional web presence fast."
                icon={Building2}
                gradient="from-orange-500 to-red-500"
                index={2}
              />
            </motion.div>
          </div>
        </section>

        {/* ─── Final CTA Section ──────────────────────────────── */}
        <section className="py-20 lg:py-28 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 relative overflow-hidden">
          {/* Subtle background elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-white rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-16 max-w-4xl text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5">
                Found a website that inspires your next idea?
              </h2>
              <p className="text-xl text-white/85 mb-10 max-w-xl mx-auto">
                Turn it into your starting point.
              </p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <button
                  type="button"
                  onClick={handlePrimaryCta}
                  className="inline-flex items-center gap-2.5 px-10 py-5 rounded-full bg-white text-orange-600 hover:bg-gray-50 font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-3xl cursor-pointer"
                >
                  Try MirrorSite AI Free
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────── */}
        <footer className="py-14 bg-gray-900 text-white">
          <div className="container mx-auto px-16 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Image
                  src="/logo.png"
                  alt="MirrorSite AI"
                  width={28}
                  height={28}
                  className="rounded-md"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                  MirrorSite AI
                </span>
              </motion.div>

              <motion.div
                className="flex gap-6 flex-wrap justify-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <Link href="/builder" className="text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2 text-sm">
                  <Code2 className="w-4 h-4" />
                  Builder
                </Link>
                <Link href="/hall-of-fame" className="text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2 text-sm">
                  <Trophy className="w-4 h-4" />
                  Hall of Fame
                </Link>
                <Link href="/pricing" className="text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2 text-sm">
                  Pricing
                </Link>
                <a
                  href="https://github.com/mendableai/open-lovable"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2 text-sm"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="https://firecrawl.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2 text-sm"
                >
                  <Zap className="w-4 h-4" />
                  Firecrawl
                </a>
              </motion.div>

              <motion.p
                className="text-gray-500 text-sm"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
              >
                © {new Date().getFullYear()} MirrorSite AI · ATAI Enterprises
              </motion.p>
            </div>
          </div>
        </footer>
      </div>
    </HeaderProvider>
  );
}
