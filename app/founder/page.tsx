import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen, MapPin } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SITE_URL } from "@/lib/env"

const name = "Masereka Adorable Kimulya"
const title = "Masereka Adorable Kimulya | Founder of Atai"
const description = "Meet Masereka Adorable Kimulya, Atai's founder from Kasese, Uganda. A story of self-taught programming, early business lessons, and a mission to widen opportunity."
const portrait = "/ADORABLE/adorable.png"

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/founder" },
  authors: [{ name, url: `${SITE_URL}/founder` }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "profile",
    title,
    description,
    url: `${SITE_URL}/founder`,
    siteName: "Atai",
    locale: "en_US",
    images: [{ url: portrait, width: 1086, height: 1448, alt: name }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: portrait, alt: name }],
  },
}

const CHAPTERS = [
  {
    id: "kasese",
    label: "Roots in Kasese",
    title: "Growing up in Kasese, Uganda",
    paragraphs: [
      "Masereka Adorable Kimulya grew up with limited financial resources in Kasese, western Uganda. Their early fascination with technology began with phones: devices that were valuable, difficult to obtain, and full of things to discover. Before there was a business plan, there was the curiosity of wanting to understand how something worked.",
      "In the manuscript, Kimulya resists turning that curiosity into a perfect origin story. Wanting a phone also meant wanting to play games and own something that felt out of reach. Over time, a childhood wish became a savings goal—and then a way into a much wider world of information.",
    ],
  },
  {
    id: "first-phone",
    label: "The first phone",
    title: "Saving for a first phone",
    paragraphs: [
      "Kimulya describes saving small amounts over several years before buying a Samsung S8 in 2024, while in secondary school. Owning a device was different from borrowing one: it created more room to explore, learn, and return to questions without waiting for someone else’s phone.",
      "Access still had a cost. Mobile data, time, family expectations, and the limits of the device shaped what was possible. Learning did not begin with a well-equipped workspace or a clear route into the technology industry. It began by making use of what was available.",
    ],
  },
  {
    id: "learning-programming",
    label: "Discovering programming",
    title: "From using technology to wanting to create it",
    paragraphs: [
      "An interest in ICT, mathematics, and physics led to an important conversation with an elder brother during secondary school. The suggestion to become a programmer introduced a new idea: apps and websites were not simply things that existed. People made them, and those skills could be learned.",
      "A school peer later demonstrated HTML, CSS, and JavaScript. Kimulya tried learning apps and searched for instruction, eventually finding longer programming lessons on YouTube. Downloading lessons helped make the most of limited internet access. The more they learned, the clearer it became that a computer would open possibilities a phone could not.",
    ],
  },
  {
    id: "carpentry",
    label: "Work before software",
    title: "Carpentry, customers, and the cost of a laptop",
    paragraphs: [
      "Some of the earliest business lessons came from practical work, not software. Around the family furniture business, Kimulya saw the relationship between materials, a useful product, a customer, and a sale. They describe learning to make wooden clothes hangers and experimenting with designs people would buy.",
      "Carpentry income, savings, and eventually selling the phone helped fund a laptop. It was a difficult trade-off: giving up one hard-earned tool to obtain another. The computer made more kinds of development possible, but limited hardware and unfamiliar software brought new obstacles.",
      "Early calculator, news, and movie projects often followed tutorials closely. Seeing something run was encouraging; understanding enough to build independently took much longer. That gap became one of the most persistent lessons in the manuscript.",
    ],
  },
  {
    id: "mixifyhub",
    label: "The MixifyHub lesson",
    title: "MixifyHub: an ambitious idea meets reality",
    paragraphs: [
      "MixifyHub began as an idea for bringing social-media accounts, scheduling, and feeds together. Kimulya invested time and scarce money in the domain, hosting, data, and development. The ambition was much larger than their experience at the time.",
      "After months of work, the prototype still contained mocked content and unfinished interactions. A demonstration on other devices exposed problems with mobile layouts. Building a page that looked right on one laptop had not produced a reliable service for other people.",
      "The manuscript is candid about those shortcomings. It describes learning the importance of responsive design, reading documentation, understanding AI APIs, and testing beyond a familiar screen. It also records a harder discovery: publishing a website does not mean that customers will arrive.",
    ],
  },
  {
    id: "pivots",
    label: "Listening and changing",
    title: "Following feedback—and learning about sustainability",
    paragraphs: [
      "Feedback suggested that the AI feature interested people more than the original social-media concept. Kimulya describes shifting through MixifyHub AI, Mixi AI, and Easy AI, exploring text and image capabilities along the way.",
      "Interest was not the same as a sustainable business. Hosting and service costs continued while advertising brought in very little. Easy AI was eventually shut down. Later chatbot, e-commerce, and school-office experiments brought more practice, but the available chapters do not present a simple breakthrough into financial success.",
      "Work on EasyShop and SchoolOffice also brought practical constraints into focus: payment-gateway access in Uganda, unreliable or unaffordable tools, messaging integrations, and an ageing laptop. AI-assisted development helped, but it did not remove the need to understand the work or make difficult choices about scope and cost.",
    ],
  },
  {
    id: "atai-mission",
    label: "The mission today",
    title: "Why Atai is about businesses, not just apps",
    paragraphs: [
      "Today, Kimulya is the founder of Atai. Their stated ambition is to help reduce poverty by giving more people practical support to create and run businesses of their own. The early experiences in the manuscript explain why access matters, and why writing software is only one part of the problem.",
      "Atai’s focus is the whole business journey: shaping an offer, creating the website or digital product it needs, hosting it, managing customers and daily operations, and working on marketing and growth. Specialized AI teams are intended to help with that work while the business owner stays in charge.",
      "This is a mission to expand opportunity, not a promise of automatic income. The distinction matters: a working product still needs useful value, customers, care, and a way to sustain itself. Those are the challenges Atai is being built around.",
    ],
  },
]

const FAQ = [
  { q: "Who is the founder of Atai?", a: "Masereka Adorable Kimulya is the founder of Atai and a Ugandan technology enthusiast and self-taught programmer. Atai helps people start, run, manage, and grow online businesses with specialized AI teams." },
  { q: "Where is Masereka Adorable Kimulya from?", a: "Kimulya is from Kasese, western Uganda. Their account describes growing up with limited resources, learning ICT and programming, and working to obtain the devices and internet access needed to keep learning." },
  { q: "What is The Rise of Atai?", a: "The Rise of Atai is the working title for a forthcoming book and documentary about the founder’s journey. The project is not yet released, and a publication date has not been announced." },
  { q: "Is this the complete founder history?", a: "No. This page is an edited account based on the currently available autobiographical manuscript and the founder’s description of Atai’s mission. The manuscript covers the early learning and business journey; it does not yet document Atai’s founding in detail." },
]

export default function FounderPage() {
  const personId = `${SITE_URL}/founder#person`
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name,
        url: `${SITE_URL}/founder`,
        image: `${SITE_URL}${portrait}`,
        description,
        jobTitle: "Founder of Atai",
        nationality: { "@type": "Country", name: "Uganda" },
        birthPlace: { "@type": "Place", name: "Kasese, Uganda" },
        worksFor: { "@id": `${SITE_URL}/#organization` },
        knowsAbout: ["ICT", "Software development", "AI-assisted development", "Online business"],
        mainEntityOfPage: { "@id": `${SITE_URL}/founder#profile` },
      },
      {
        "@type": "ProfilePage",
        "@id": `${SITE_URL}/founder#profile`,
        url: `${SITE_URL}/founder`,
        name: title,
        description,
        inLanguage: "en",
        mainEntity: { "@id": personId },
        author: { "@id": personId },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        breadcrumb: { "@id": `${SITE_URL}/founder#breadcrumbs` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/founder#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "About Atai", item: `${SITE_URL}/about` },
          { "@type": "ListItem", position: 3, name, item: `${SITE_URL}/founder` },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/founder#questions`,
        mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  }

  return (
    <div className="workspace-environment min-h-svh bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <SiteHeader activePage="/founder" />
      <main className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-8 lg:px-10">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-6 text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">Home</Link><span aria-hidden="true">/</span>
          <Link href="/about" className="hover:text-foreground hover:underline">About Atai</Link><span aria-hidden="true">/</span>
          <span aria-current="page">The founder</span>
        </nav>

        <header className="grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:gap-16 lg:py-16">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">The founder of Atai</p>
            <h1 className="mt-5 text-balance text-4xl font-black leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{name}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">A Ugandan technology enthusiast, self-taught programmer, and founder working to make business ownership more accessible.</p>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">From growing up with limited means in Kasese to learning how to create with technology, this is an early account of the journey behind Atai’s ambition: helping more people build a livelihood through a business of their own.</p>
            <p className="mt-6 flex items-center gap-2 text-sm font-medium"><MapPin className="size-4 text-primary" /> Kasese, Uganda</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#kasese" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>Read the story <ArrowRight className="size-4" /></a>
              <a href="#book" className={buttonVariants({ variant: "outline", size: "lg" })}>The Rise of Atai</a>
            </div>
          </div>
          <figure className="mx-auto w-full max-w-sm lg:max-w-none">
            <Image src={portrait} alt={name} width={1086} height={1448} preload sizes="(min-width: 1024px) 36vw, (min-width: 640px) 384px, 100vw" className="h-auto w-full rounded-[1.75rem] border border-border object-contain" />
            <figcaption className="mt-3 text-xs leading-6 text-muted-foreground">{name} · Founder of Atai</figcaption>
          </figure>
        </header>

        <div className="grid items-start gap-10 border-t border-border pt-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto">
            <nav aria-label="Founder story chapters" className="rounded-2xl border border-border bg-card/70 p-5">
              <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-primary">In this story</p>
              <ol className="space-y-3 text-sm leading-6 text-muted-foreground">
                {CHAPTERS.map((chapter, index) => (
                  <li key={chapter.id}><a href={`#${chapter.id}`} className="flex gap-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span aria-hidden="true" className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</span>{chapter.label}</a></li>
                ))}
                <li><a href="#book" className="hover:text-foreground">The forthcoming book</a></li>
                <li><a href="#questions" className="hover:text-foreground">Questions about the founder</a></li>
              </ol>
            </nav>
          </aside>

          <article className="min-w-0 max-w-3xl">
            <p className="mb-12 border-l-2 border-primary/40 pl-5 text-sm leading-7 text-muted-foreground">Adapted from Kimulya’s autobiographical manuscript. These chapters tell the early learning and business journey; the fuller story is still being written.</p>
            {CHAPTERS.map((chapter, index) => (
              <section key={chapter.id} id={chapter.id} className="mb-14 scroll-mt-24">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">{String(index + 1).padStart(2, "0")} · {chapter.label}</p>
                <h2 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{chapter.title}</h2>
                <div className="mt-5 space-y-5 text-base leading-8 text-muted-foreground">{chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              </section>
            ))}

            <blockquote className="mb-14 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <p className="text-xl font-semibold leading-9 sm:text-2xl">“AI doesn’t replace understanding. It only assists it.”</p>
              <footer className="mt-4 text-sm leading-6 text-muted-foreground">— {name}, from the autobiographical manuscript</footer>
            </blockquote>

            <section id="book" className="mb-14 scroll-mt-24 rounded-2xl border border-border bg-card p-6 sm:p-8">
              <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-primary"><BookOpen className="size-4" /> Forthcoming book & documentary</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">The Rise of Atai</h2>
              <p className="mt-2 text-sm text-muted-foreground">Working title · Not yet released</p>
              <p className="mt-5 text-base leading-8 text-muted-foreground">Kimulya is developing the fuller story into a book and documentary. The current manuscript explores learning to program in Uganda, the cost of getting started, early projects, and the difference between creating software and sustaining a business.</p>
              <p className="mt-4 text-base leading-8 text-muted-foreground">A publication date has not been announced. This page is an introduction to the available chapters, not the complete book or a claim that the story is finished.</p>
            </section>

            <section id="questions" className="scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Questions about Atai’s founder</h2>
              <div className="mt-6 divide-y divide-border">
                {FAQ.map(({ q, a }) => (
                  <details key={q} className="py-1">
                    <summary className="cursor-pointer py-4 text-base font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{q}</summary>
                    <p className="pb-5 text-base leading-8 text-muted-foreground">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
              <Link href="/about" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>Explore Atai’s mission <ArrowRight className="size-4" /></Link>
              <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>Start your own business</Link>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter activePage="/founder" />
    </div>
  )
}
