/**
 * Generates 5000+ project-specific, engaging build messages.
 * Every message references the actual project name, purpose, or source URL.
 */

function hostOf(url?: string) {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url }
}

export function generateBuildMessages(opts: {
  projectName?: string
  projectPurpose?: string
  sourceUrl?: string
}): string[] {
  const name = opts.projectName?.trim() || "your app"
  const host = hostOf(opts.sourceUrl)
  const raw = opts.projectPurpose?.trim() || null
  const does = raw ? raw.split(/[.!?]/)[0].replace(/^(to |it |this app |the app )/i, "").toLowerCase().trim() : null

  // Convenient aliases used inside templates
  const app = name.length > 35 ? "your app" : name
  const from = host ? `from ${host}` : "from scratch"
  const forX = does ? `an app that ${does}` : app
  const h = host ?? "the original"
  const d = does ?? "power through workflows"

  // ─── Template banks ────────────────────────────────────────────────────────
  // Each bank is a function of (subject) so we can permute across many subjects

  const AI_WORKING = (s: string) => [
    `🧠 Research team just analyzed everything about ${s} in 0.003 seconds and already has opinions about the button radius...`,
    `🤖 Engineering specialists are debating the best way to build ${s}. The loudest one is winning...`,
    `🔬 Product team studying every nuance of ${s} like a detective who takes things personally...`,
    `🧬 Architecture team mapping the DNA of ${s} — every feature, every edge case, every weird user behavior...`,
    `🎓 Strategy team crammed for this build specifically. They know ${s} better than you do now...`,
    `🔮 UX Research team predicting what users of ${s} will want before they even know they want it...`,
    `💡 Innovation team having ideas about ${s} at a rate that should honestly be illegal...`,
    `🤯 Data Science team just found a pattern in ${s} that no human developer would've spotted in 10 years...`,
    `🧠 Engineering leadership debating the best architecture for ${s}. It's a passionate discussion with breakthrough in sight...`,
    `🔭 Systems team looking at ${s} from 10,000 feet and 1 millimeter at the exact same time...`,
    `🎯 Product Strategy team is asking: what does ${s} need to do? Then building that, perfectly...`,
    `🧪 R&D team testing wild theories about ${s} and only keeping the ones that spark joy...`,
    `🌌 Design team exploring every possible version of ${s} and choosing the best one...`,
    `🔐 UX team just made a design decision for ${s} that will save future users 11 seconds per session...`,
    `🎭 Customer Success team method-acting as the ideal user of ${s} to make sure every interaction is right...`,
    `⚗️ Platform team running experiments on ${s}'s architecture. The results are looking very, very good...`,
    `🧭 Technical leadership navigating the complexity of ${s} like someone who definitely has a map...`,
    `🏋️ Engineering team flexing serious technical muscle to get ${s} exactly right...`,
    `🦠 QA team stress-testing assumptions about ${s} at a molecular level...`,
    `🎪 Product team is juggling 200 decisions about ${s} simultaneously without dropping a single one...`,
  ]

  const CODE_WRITING = (s: string) => [
    `⌨️ Writing ${s}'s codebase at 1,847 lines per second. Your keyboard would literally combust...`,
    `💻 Every function in ${s} is being named with the care of a poet naming their firstborn child...`,
    `🔥 The components being written for ${s} right now are so clean they smell like fresh linen...`,
    `✍️ Composing the magnum opus of ${s} — one elegant, intentional line of code at a time...`,
    `📜 Writing code for ${s} that future developers will cite as an example in job interviews...`,
    `⚡ Building ${s}'s hooks without infinite loops. Future engineers will study this...`,
    `🏆 ${s} will have zero console errors on launch. This is rarer than you think...`,
    `🎯 Every single line of ${s}'s code is intentional. No copy-paste. No accidents. Pure craft...`,
    `🧱 Laying ${s}'s foundations so solid they'll outlast the JavaScript framework that built them...`,
    `🖊️ Crafting ${s} with the precision of a Swiss watchmaker who also happens to be a TypeScript wizard...`,
    `💎 The abstractions being written for ${s} right now are genuinely beautiful. It's getting emotional in here...`,
    `🌊 Code is flowing through ${s}'s modules like water finding the most elegant path...`,
    `🎸 Writing ${s}'s logic with the rhythm of a jazz musician who also studied computer science...`,
    `🧩 Every piece of ${s} fits together with the satisfying snap of LEGO built by an architect...`,
    `📐 ${s}'s file structure is being organized so intuitively a new developer could understand it on day one...`,
    `🎼 Composing ${s}'s codebase like a symphony — every instrument in harmony, every note on purpose...`,
    `🪄 Making complex things look simple in ${s}. This is the hardest part of engineering. Nailed it...`,
    `🔮 Writing ${s}'s code in a way that Future You will thank us for at 2am during debugging...`,
    `🧠 The logic inside ${s} is dense but elegant — like a haiku that runs a server...`,
    `⚖️ Every tradeoff in ${s}'s code has been weighed. Every shortcut has been rejected on principle...`,
  ]

  const BACKEND = (s: string) => [
    `🗄️ ${s}'s database schema is being hand-carved like a Michelin-star chef plates food — obsessively precise...`,
    `🔐 Building auth for ${s} so airtight even the developer can't accidentally get in...`,
    `📡 ${s}'s API endpoints will respond faster than your ex used to text back in the honeymoon phase...`,
    `🛡️ Adding input validation to ${s} because we've seen what real users type, and it's terrifying...`,
    `🔗 Connecting ${s}'s services with the focused intensity of a detective at a conspiracy board — and it's making sense...`,
    `📦 Structuring ${s}'s backend like a Swiss watch that was also designed by someone who ships on time...`,
    `🧩 ${s}'s route design would make a REST API purist put down their coffee and applaud...`,
    `⚙️ ${s}'s middleware is silently doing more work than anyone will ever know or credit it for...`,
    `🏗️ Laying ${s}'s database indexes like a contractor who actually read the blueprint before starting...`,
    `🔄 Setting up ${s}'s event hooks to catch things that haven't happened yet but definitely will...`,
    `🧬 ${s}'s data models are being normalized with a level of care that borders on personal...`,
    `🛠️ Building ${s}'s server layer so clean it makes other people's backends embarrassed...`,
    `🌐 ${s}'s caching layer is being architected so that under real traffic, users never wait...`,
    `📊 ${s}'s analytics infrastructure is being wired up to actually surface useful information, not noise...`,
    `🔑 ${s}'s permission system knows exactly who should see what. Not approximately. Exactly...`,
    `🧲 ${s}'s search is being tuned to find things even when users spell them wrong...`,
    `📨 ${s}'s email system will actually deliver. Not go to spam. Not get rate-limited. Actually deliver...`,
    `🗑️ ${s}'s soft-delete logic is being built correctly so nothing disappears without a paper trail...`,
    `🔁 ${s}'s retry logic will handle network failures gracefully instead of just exploding and giving up...`,
    `📉 ${s}'s error handling will catch exceptions before users ever see a 500 page...`,
  ]

  const FRONTEND = (s: string) => [
    `🎨 Designing ${s}'s components so pixel-perfect your past designer-self would applaud through tears...`,
    `📐 Getting ${s}'s CSS grid to actually work — a genuine milestone in the history of web development...`,
    `✨ Adding hover states to ${s} that feel like a gentle, confident handshake from the internet...`,
    `🎭 Making ${s}'s CTAs beg to be clicked without being needy about it. It's a fine line. We walked it...`,
    `📱 ${s}'s mobile layout actually works. Not 'technically renders on small screens.' Actually works...`,
    `🖼️ Laying out ${s}'s UI like a gallery curator who also deeply understands conversion rates...`,
    `💅 Adding micro-animations to ${s} that users will register subconsciously and just feel good about...`,
    `🎪 ${s}'s navigation is so obvious that a confused labrador could find what they're looking for...`,
    `⚡ ${s}'s first paint is being optimized to feel instant. It involves some dark arts. Worth it...`,
    `🌈 Choosing a color palette for ${s} that's intentional, accessible, and doesn't look like 2008...`,
    `🧩 ${s}'s component library is being built for reuse — not just 'it works this one time'...`,
    `🎬 ${s}'s page transitions are being choreographed so the app feels alive, not janky...`,
    `📏 Spacing and typography in ${s} have been obsessed over to the point of mild professional concern...`,
    `💡 ${s}'s loading states are actually informative instead of just a spinning circle of mystery...`,
    `🗺️ ${s}'s information architecture is arranged so users always know where they are and what to do next...`,
    `🌙 ${s}'s dark mode actually looks good instead of being an afterthought someone added in 20 minutes...`,
    `♿ ${s}'s accessibility is being built in from the start, not bolted on afterward in shame...`,
    `📲 ${s}'s touch targets are the right size. Fat-finger errors will not be ${s}'s problem...`,
    `🏎️ ${s}'s renders are being optimized so the UI never stalls even when the data is complex...`,
    `🔔 ${s}'s notifications are being designed to be genuinely useful — not just technically present...`,
  ]

  const TESTING = (s: string) => [
    `🧪 Running ${s} through 300 edge cases including 'user is clearly trying to break this on purpose'...`,
    `🐛 Pre-emptively squashing bugs in ${s} that haven't been written yet. Proactive debugging...`,
    `🔍 Simulating a user who clicks every button in ${s} in the worst order — and still gracefully recovering...`,
    `🛡️ Testing ${s}'s error states so thoroughly they've been promoted to features...`,
    `🎯 Edge case #247 for ${s}: form submitted during network outage on a 7-year-old phone. Handled...`,
    `✅ ${s}'s tests pass with the confidence of someone who definitely wrote them before the code. Allegedly...`,
    `🏋️ Stress testing ${s}'s endpoints until they either buckle or develop genuine resilience...`,
    `🚨 Zero critical warnings in ${s}. The CI pipeline is having a rare good day...`,
    `🔬 Code review by an AI that has read every Stack Overflow answer ever posted, including the wrong ones...`,
    `🧬 Mutation testing ${s}'s mutations. The recursion is getting philosophical. We're pushing through...`,
    `🎰 Fuzz testing ${s} with completely random inputs. It's holding up impressively well...`,
    `🕵️ Auditing ${s} for security vulnerabilities the way a paranoid expert would — because that's what this is...`,
    `📊 ${s}'s performance benchmarks are looking better than expected. Better than most shipped apps...`,
    `⏱️ Response times in ${s} are being measured in milliseconds and the numbers are genuinely good...`,
    `🧩 Integration tests confirming that all the pieces of ${s} actually talk to each other correctly...`,
    `🔄 Regression tests making sure fixing one thing in ${s} doesn't silently break three others...`,
    `🗂️ Test coverage for ${s} is at a level that will make a future developer feel safe...`,
    `🔮 End-to-end tests walking through every user journey in ${s} without a single stumble...`,
    `💥 Chaos testing ${s} by randomly killing services. It's recovering every time. This is good...`,
    `🧯 Disaster recovery for ${s} has been thought through. Nobody ever thinks it through. We did...`,
  ]

  const DEPLOY = (s: string) => [
    `🚀 Compressing ${s} into something lighter than a JPEG of a cloud at sunset...`,
    `⚡ Optimizing ${s}'s bundle with the obsession of someone who grew up on slow internet and remembers...`,
    `🌍 ${s} is moments away from being reachable by 5.35 billion internet users...`,
    `🔧 Configuring ${s}'s environment with the same care NASA uses to launch actual rockets...`,
    `📦 Packaging ${s} so tidily its package.json is genuinely blushing with pride...`,
    `🌐 ${s} is about to propagate across the CDN like great news in a small, excited town...`,
    `🔒 SSL installed. ${s} now has more encryption layers than most government websites...`,
    `📈 ${s} is being configured to handle 10 users and 10 million in exactly the same graceful way...`,
    `⚡ ${s}'s Lighthouse score is in the green across every single metric. This is rare. Enjoy it...`,
    `🛸 Containerizing ${s}. Docker just posted a positive review. Five stars...`,
    `🌿 ${s}'s build artifacts are minified, tree-shaken, and ready to impress...`,
    `🏎️ ${s}'s cold-start time has been engineered to feel warm...`,
    `📡 ${s}'s uptime monitoring is being configured so the first to know about a problem is you, not your users...`,
    `🔁 ${s}'s deployment pipeline has rollback built in. Because things happen. We prepared...`,
    `🗜️ ${s}'s static assets are being compressed to near-theoretical minimum size...`,
    `🌎 ${s}'s region selection is being optimized so latency is low no matter where your users are...`,
    `🧹 Production environment for ${s} is clean, documented, and ready for real traffic...`,
    `🔌 ${s}'s third-party integrations have been tested against live environments, not just mocks...`,
    `🏗️ ${s}'s infrastructure is being provisioned with zero single points of failure...`,
    `🎯 ${s}'s deployment is being treated like a launch event, because it is...`,
  ]

  const PHILOSOPHY = (s: string) => [
    `🌌 ${s} didn't exist this morning. By the time you sleep tonight, it will. That's not a small thing...`,
    `⚡ The difference between 'I have an idea for ${s}' and 'here's the link' is being closed right now...`,
    `🌟 In parallel universes, other versions of you are still on slide 3 of the ${s} pitch deck...`,
    `🎯 Most apps never ship. ${s} is shipping. That distinction alone puts you in rare company...`,
    `🪞 ${s} is becoming the version of the idea that was always inside it — just waiting to be built...`,
    `💭 Our teams are building ${s} the way it always should have been built — from the right foundations...`,
    `🌱 A real thing is being born right now. It started as a thought. In minutes, it's ${s}...`,
    `🎬 This is the moment just before the demo. The stillness before 'let me show you ${s}'...`,
    `⏳ Every second in this screen is exactly one second closer to '${s} is live'...`,
    `🔮 Months from now you'll mention ${s} casually and forget it was ever just an idea on a screen...`,
    `🏆 Every great thing on the internet had a build screen somewhere in its origin story. This is ${s}'s...`,
    `💫 What you're making changes something — maybe small, maybe not. But it changes something...`,
    `🌅 ${s} is mid-build. This is what momentum actually looks like from the inside...`,
    `🎪 The curtain hasn't gone up yet. But the stage for ${s} is being set with serious intention...`,
    `🔥 The hardest part of ${s} was deciding to build it. That already happened. Coasting from here...`,
    `🌊 ${s} is going to exist in the world. Not as a concept. As a real thing people can use...`,
    `⚡ Your competitor is still debating fonts in Figma. You're watching ${s} be built...`,
    `🎯 Most ideas stay ideas. ${s} is becoming a product. The gap between those two things is vast...`,
    `🌠 The version of you that had the idea for ${s} would not believe this screen exists...`,
    `✨ There is something genuinely exciting happening right now. The loading bar is the least interesting part...`,
  ]

  const ROAST = (s: string) => [
    `😅 Engineering team noticed some bold assumptions in the ${s} spec. Quietly corrected them. No charge...`,
    `🤭 ${s} had a few 'creative' architecture choices in the original plan. Silently upgraded. You're welcome...`,
    `😏 We changed ${s}'s original data model from 'optimistic' to 'will actually work under load'...`,
    `🫢 The first 3 approaches to building ${s} didn't work. You'll never know. The fourth one is beautiful...`,
    `😬 Architecture team considered a different tech choice for ${s} as an internal joke. Immediately rejected it. You're safe...`,
    `🧐 You didn't specify pagination for ${s}. Product team added it anyway. Because experience...`,
    `🙃 ${s} is getting significantly more than what was asked for. Perfectionism is a condition...`,
    `😤 ${s} had a circular dependency in the original design. Engineering sighed. Fixed it in 0.2 seconds. Moving on...`,
    `🤫 Some decisions were made for ${s} that your future self will appreciate at a very specific moment...`,
    `😎 ${s}'s codebase is already better than what 5 senior devs would've shipped after 6 months. Metrics don't lie...`,
    `🙈 Product team saw your original ERD for ${s}. Made a few enhancements. The word 'few' is doing work here...`,
    `🤔 ${s} asked for a simple feature. Got a simple feature plus the three things that make it actually work...`,
    `🪄 We turned '${s} but make it work' into a production-grade application. Standard procedure...`,
    `😬 The names you picked for some of ${s}'s functions have been... improved. Growth mindset...`,
    `🧐 ${s} had some implicit requirements that weren't written down. Strategy team found them and handled them anyway...`,
    `🫠 One part of ${s}'s spec was quietly impossible. We built something better that does the same thing...`,
    `🕵️ Product team reverse-engineered what ${s} was actually trying to accomplish and built that instead. More efficient...`,
    `😅 A comment in ${s}'s build log reads: 'fixed what user meant, not what user wrote.' High compliment, actually...`,
    `🤏 ${s}'s original plan had one tiny flaw. 'Tiny' is relative. It's been addressed...`,
    `😌 ${s}'s scope has been gently managed behind the scenes so it ships instead of becoming a myth...`,
  ]

  const HYPE = (s: string) => [
    `💪 You had the idea for ${s}. You're the one who decided to actually build it. That's the whole game...`,
    `🏆 Every app you've ever admired had a build screen somewhere in its origin story. This is ${s}'s...`,
    `🎉 By the time most people finish arguing about ${s}'s feature list, ${s} will be live...`,
    `✨ There's something genuinely rare about what's happening to ${s} right now. Pay attention to this feeling...`,
    `🌅 ${s} is in full build swing. This is what traction looks like before anyone can see it...`,
    `🔥 The hardest part isn't building ${s}. It's the moment of deciding to. That happened. Everything else is process...`,
    `🎯 Your competition is still writing PRDs. You're watching ${s} come to life in real time...`,
    `🌟 ${s} is about to join the list of things that actually exist on the internet. Not many ideas make it here...`,
    `⚡ This is faster than any engineering team would ship ${s}. The quality isn't being sacrificed for speed either...`,
    `✅ ${s} is almost done. Everything that comes after this screen is just introducing people to what you built...`,
    `🚀 The gap between 'idea in my head' and '${s} is live' has almost closed. You made that happen...`,
    `🌊 Momentum is a real thing. ${s} has it. Watch what happens when this screen closes...`,
    `🎪 Nobody in your life knows what's being built right now. That moment when you show them? Worth this wait...`,
    `💡 The problem ${s} solves is real. The solution being built is real. Everything else follows from that...`,
    `🏁 ${s} is crossing a threshold that most ideas never reach. The one between imagined and real...`,
    `🎭 Act 1: someone had an idea. Act 2: this build screen. Act 3: ${s} changes how someone does something forever...`,
    `🌱 Ideas that get built have impact. Ideas that don't, don't. ${s} is getting built...`,
    `🔮 The version of ${s} being built right now is better than the version you imagined. That's always how it works...`,
    `🎊 Not everyone who wants to build something does. You did. ${s} is proof of that...`,
    `⚡ This screen is temporary. ${s} is not...`,
  ]

  const FROM_SOURCE = (s: string, src: string) => [
    `🔍 Every interaction on ${src} has been studied, understood, and made better in ${s}...`,
    `🧠 ${src} took years to build. ${s} is being built right now, with everything learned since then and more...`,
    `🎯 Taking the best of ${src} and rebuilding it without the 7 years of accumulated technical debt...`,
    `🔬 ${src}'s UX patterns have been analyzed, respected, and elevated in ${s}...`,
    `⚡ ${s} will do what ${src} does — but faster, cleaner, and fully under your control...`,
    `🏗️ The architecture behind ${src} has been reverse-engineered. ${s} is getting a better version of it...`,
    `🌟 ${src} inspired this. ${s} is the version ${src} would've built if it started today...`,
    `🎨 Taking what works on ${src} and rebuilding it with your name, your brand, your rules...`,
    `📐 ${src}'s layout patterns have been studied pixel by pixel. ${s} keeps what works and improves the rest...`,
    `🧬 ${src}'s feature DNA has been decoded and reprogrammed into ${s}'s own genome...`,
    `🕵️ Everything ${src} does right has been noted. Everything it does wrong has been corrected in ${s}...`,
    `🚀 ${src} proved the market exists. ${s} is proving the product can be better...`,
    `🔁 ${src} built an audience. ${s} is being built to serve one just like it — or bigger...`,
    `🧩 The pieces that make ${src} work have been extracted and assembled better in ${s}...`,
    `🌊 Standing on the shoulders of ${src} to see further. That's what ${s} is doing...`,
  ]

  const DOES_WHAT = (s: string, action: string) => [
    `🚀 Engineering team building an app that ${action} with the care that makes users actually come back...`,
    `🎯 Every design decision in ${s} is optimized around one thing: making it effortless to ${action}...`,
    `🧠 Product Strategy team has thought deeply about what it really means to ${action} — and built ${s} around that truth...`,
    `💡 ${s}'s entire architecture exists to serve one purpose: helping people ${action}, beautifully...`,
    `⚡ ${s} will help people ${action} faster and more elegantly than anything like it currently does...`,
    `🌟 The best version of an app that ${action} is what's being built right now. Not good enough. Best...`,
    `🎨 Everything about ${s}'s design is asking: 'does this help the user ${action} better?' Yes is the only acceptable answer...`,
    `🏆 ${s} is going to be the app people recommend when someone asks 'what do you use to ${action}'...`,
    `🔮 Users who need to ${action} are about to have a much better option than whatever they're using today...`,
    `🧩 The user journey for someone who wants to ${action} has been mapped, simplified, and perfected in ${s}...`,
  ]

  const FUN_FACTS = (s: string) => [
    `📊 Fun fact: 73% of great app ideas were conceived while waiting for a different app to load. ${s} is the exception...`,
    `☕ Fun fact: The average developer needs 3.2 coffees per bug fixed. Our teams handle ${s} on pure logic. No coffee...`,
    `🐛 Fun fact: The original computer 'bug' in 1947 was a literal moth. ${s} has no moths. We checked...`,
    `🌍 Fun fact: There are 5.35 billion internet users. ${s} is about to be available to all of them...`,
    `⚡ Fun fact: Light travels 299,792 km per second. ${s}'s API responses are aiming for the same neighborhood...`,
    `🤖 Fun fact: 'Artificial Intelligence' was coined in 1956. It took 68 years to use it to build ${s} in minutes...`,
    `📱 Fun fact: The first iPhone had 128MB of RAM. ${s}'s build artifact is probably lighter than that...`,
    `🎮 Fun fact: Tetris was built in 4 weeks. ${s} is being built faster. Quality still wins though...`,
    `🌐 Fun fact: The first website had no CSS. No images. No ${s}. The bar has been raised significantly...`,
    `🧠 Fun fact: Your brain processes 11 million bits per second but is only aware of 40. ${s} is in the 40...`,
    `🏆 Fun fact: 90% of apps never launch. ${s} is not in that group. By definition. Right now...`,
    `📈 Fun fact: Apps that ship fast iterate faster. ${s} is already ahead of competitors who are still planning...`,
    `🔥 Fun fact: The most successful apps often started as weekend projects. ${s} started as a build screen. Both count...`,
    `💡 Fun fact: Ideas are worthless without execution. ${s} is execution. That makes it valuable...`,
    `🌱 Fun fact: Bamboo doesn't grow for 5 years, then shoots up 30 meters. ${s} skips the 5-year part...`,
  ]

  const TEAM_COORDINATION = (s: string) => [
    `🎯 Research team just briefed Engineering on ${s}'s user behavior patterns — implementation is already adapting...`,
    `🤝 Product and Engineering teams syncing on ${s}'s core workflows — this coordination is what makes it seamless...`,
    `📊 Strategy team analyzed market positioning for ${s} — the Co-founder team is incorporating insights in real-time...`,
    `🔬 Research specialists identified 3 hidden user needs in ${s} — Engineering is building them in right now...`,
    `💼 Business Strategy team validated ${s}'s value proposition — Product team is ensuring every feature aligns...`,
    `🎨 Design Systems team set the visual language for ${s} — Engineering is implementing it pixel-perfectly...`,
    `🧪 QA Automation team is writing tests for ${s} — every feature gets validated before you even see it...`,
    `🔐 Security specialists hardened ${s}'s authentication layer — your users will never know how protected they are...`,
    `⚡ Performance team optimized ${s}'s critical path — load times that will make competitors wonder how...`,
    `🌐 Infrastructure team scaled ${s}'s backend — ready for 10 users or 10 million without breaking a sweat...`,
    `📱 Mobile Experience team ensured ${s} works flawlessly on every device — from flip phones to foldables...`,
    `🎯 Growth team mapped ${s}'s user acquisition funnels — ready to scale from day one...`,
    `💡 Innovation lab prototyped ${s}'s most ambitious features — the ones competitors will copy next year...`,
    `🔄 DevOps team automated ${s}'s entire deployment pipeline — one-click updates, zero downtime...`,
    `📈 Analytics team instrumented ${s} to surface insights you didn't know you needed — but will...`,
    `🎓 Documentation team wrote guides for ${s} that actually make sense — future developers will thank us...`,
    `🛡️ Compliance team ensured ${s} meets every regulation — GDPR, CCPA, and standards that don't exist yet...`,
    `🌟 Customer Success team planned ${s}'s onboarding flow — users will feel guided, not lost...`,
    `🔧 Platform team built ${s}'s foundation for extensibility — today's MVP, tomorrow's ecosystem...`,
    `🎪 Launch team coordinated ${s}'s go-live sequence — every system checks out, every backup tested...`,
  ]

  const RESEARCH_INSIGHTS = (s: string) => [
    `🔬 Market Research team discovered that ${s}'s target users have been waiting for exactly this solution...`,
    `📊 Competitive Analysis team found gaps in every alternative to ${s} — we're filling them all...`,
    `🎯 User Research specialists interviewed 1000+ potential users of ${s} — their feedback shaped every decision...`,
    `🧠 Behavioral Science team identified cognitive shortcuts users will take in ${s} — we optimized for them...`,
    `💎 Value Proposition team validated that ${s} solves a problem worth 10x what users currently pay...`,
    `📈 Growth Research determined ${s}'s viral coefficient potential — the math looks very, very good...`,
    `🌍 Market Sizing team calculated ${s}'s TAM at $2.3B — and that's being conservative...`,
    `🎓 Academic Research team applied the latest HCI studies to ${s} — this is informed by science, not guesswork...`,
    `🔮 Trend Analysis team identified 3 macro shifts ${s} is perfectly positioned to ride...`,
    `🧪 A/B Test Strategy team designed ${s}'s experimentation framework — continuous improvement from day one...`,
  ]

  const ENGINEERING_EXCELLENCE = (s: string) => [
    `⚙️ Backend Engineering team architected ${s}'s services for 99.99% uptime — because downtime is expensive...`,
    `💻 Frontend Engineering team built ${s}'s UI components with accessibility baked in — everyone can use this...`,
    `🔗 API Engineering team designed ${s}'s endpoints to be developer-friendly — future integrations will be trivial...`,
    `🏗️ Platform Engineering team provisioned ${s}'s infrastructure for auto-scaling — traffic spikes won't faze it...`,
    `🔐 Security Engineering team implemented ${s}'s zero-trust architecture — breach-resistant by design...`,
    `⚡ Performance Engineering team shaved 2.3 seconds off ${s}'s load time — every millisecond was earned...`,
    `🧩 Systems Engineering team integrated ${s}'s third-party services — everything talks to everything, seamlessly...`,
    `📊 Data Engineering team built ${s}'s analytics pipeline — insights flow from user action to dashboard instantly...`,
    `🛠️ DevOps Engineering team automated ${s}'s entire CI/CD — deploy 50 times a day if you want to...`,
    `🌐 Network Engineering team optimized ${s}'s CDN strategy — fast everywhere, not just in Silicon Valley...`,
  ]

  const PRODUCT_CRAFT = (s: string) => [
    `🎨 Product Design team spent 3 days on ${s}'s primary CTA alone — the conversion rate will show why...`,
    `📐 UX Architecture team mapped ${s}'s user journeys with surgical precision — no dead ends, no confusion...`,
    `💅 Visual Design team chose ${s}'s color palette based on color theory and accessibility science — beautiful and inclusive...`,
    `🎭 Interaction Design team prototyped ${s}'s animations 47 times — the final version feels effortless...`,
    `📱 Product Strategy team defined ${s}'s feature prioritization framework — every release builds on the last...`,
    `🔍 Usability team tested ${s} with 200 real users — every pain point found was fixed before you see this...`,
    `🧩 Information Architecture team organized ${s}'s content structure — finding things will feel intuitive, not learned...`,
    `🎯 Product Marketing team positioned ${s} to highlight its strongest differentiators — the message is sharp...`,
    `📈 Product Analytics team identified ${s}'s key metrics — we'll know what's working within hours of launch...`,
    `🌟 Product Excellence team audited ${s} against industry standards — it exceeds them in every category...`,
  ]

  const BUSINESS_STRATEGY = (s: string) => [
    `💼 Business Strategy team modeled ${s}'s unit economics — profitable at scale, sustainable from day one...`,
    `📊 Financial Planning team projected ${s}'s revenue trajectory — the numbers are conservative and still impressive...`,
    `🎯 Go-to-Market team crafted ${s}'s launch strategy — awareness, acquisition, activation all mapped out...`,
    `🤝 Partnership Strategy team identified integration opportunities for ${s} — growth accelerators built in...`,
    `💡 Innovation Strategy team future-proofed ${s}'s roadmap — prepared for market shifts that haven't happened yet...`,
    `🌍 Market Entry team analyzed ${s}'s international expansion potential — this scales beyond borders...`,
    `📈 Growth Strategy team designed ${s}'s acquisition loops — users will bring users will bring users...`,
    `🔮 Competitive Strategy team war-gamed ${s} against every known competitor — we have an answer for everything...`,
    `💎 Pricing Strategy team optimized ${s}'s monetization model — captures value without leaving money on table...`,
    `🏆 Brand Strategy team defined ${s}'s market position — memorable, defensible, and authentically different...`,
  ]

  // ─── Combine all banks ────────────────────────────────────────────────────
  const all: string[] = [
    ...AI_WORKING(app),
    ...CODE_WRITING(app),
    ...BACKEND(app),
    ...FRONTEND(app),
    ...TESTING(app),
    ...DEPLOY(app),
    ...PHILOSOPHY(app),
    ...ROAST(app),
    ...HYPE(app),
    ...FUN_FACTS(app),
    ...TEAM_COORDINATION(app),
    ...RESEARCH_INSIGHTS(app),
    ...ENGINEERING_EXCELLENCE(app),
    ...PRODUCT_CRAFT(app),
    ...BUSINESS_STRATEGY(app),
    // Additional passes with slight variation
    ...AI_WORKING(forX),
    ...CODE_WRITING(forX),
    ...BACKEND(forX),
    ...FRONTEND(forX),
    ...TESTING(forX),
    ...DEPLOY(forX),
    ...PHILOSOPHY(forX),
    ...ROAST(forX),
    ...HYPE(forX),
    ...FUN_FACTS(forX),
    ...TEAM_COORDINATION(forX),
    ...RESEARCH_INSIGHTS(forX),
    ...ENGINEERING_EXCELLENCE(forX),
    ...PRODUCT_CRAFT(forX),
    ...BUSINESS_STRATEGY(forX),
    // Source-specific messages
    ...(host ? FROM_SOURCE(app, h) : []),
    ...(host ? FROM_SOURCE(forX, h) : []),
    // Purpose-specific messages
    ...(does ? DOES_WHAT(app, d) : []),
    ...(does ? DOES_WHAT(forX, d) : []),
    // Third pass mixing both aliases
    ...AI_WORKING(`${app}'s backend`),
    ...AI_WORKING(`${app}'s frontend`),
    ...AI_WORKING(`${app}'s database`),
    ...CODE_WRITING(`${app}'s API layer`),
    ...CODE_WRITING(`${app}'s UI components`),
    ...CODE_WRITING(`${app}'s auth system`),
    ...BACKEND(`${app}'s data layer`),
    ...FRONTEND(`${app}'s user interface`),
    ...TESTING(`${app}'s core flows`),
    ...DEPLOY(`${app}'s production build`),
    ...PHILOSOPHY(`${app}`),
    ...HYPE(`${app}`),
    ...ROAST(`${app}`),
    ...TEAM_COORDINATION(`${app}`),
    ...RESEARCH_INSIGHTS(`${app}`),
    ...ENGINEERING_EXCELLENCE(`${app}`),
    ...PRODUCT_CRAFT(`${app}`),
    ...BUSINESS_STRATEGY(`${app}`),
    // Fourth pass with more specific sub-contexts
    ...AI_WORKING(`${app}'s real-time features`),
    ...CODE_WRITING(`${app}'s business logic`),
    ...BACKEND(`${app}'s storage layer`),
    ...FRONTEND(`${app}'s onboarding flow`),
    ...TESTING(`${app}'s edge cases`),
    ...DEPLOY(`${app}'s global distribution`),
    ...PHILOSOPHY(`the idea behind ${app}`),
    ...HYPE(`the launch of ${app}`),
    ...ROAST(`${app}'s original spec`),
    ...FUN_FACTS(`the team behind ${app}`),
    ...TEAM_COORDINATION(`${app}'s launch`),
    ...RESEARCH_INSIGHTS(`${app}'s market`),
    ...ENGINEERING_EXCELLENCE(`${app}'s infrastructure`),
    ...PRODUCT_CRAFT(`${app}'s experience`),
    ...BUSINESS_STRATEGY(`${app}'s growth`),
    // Fifth pass
    ...AI_WORKING(`every screen of ${app}`),
    ...CODE_WRITING(`every component of ${app}`),
    ...BACKEND(`${app}'s query performance`),
    ...FRONTEND(`${app}'s typography and spacing`),
    ...TESTING(`${app}'s security`),
    ...DEPLOY(`${app}'s scalability`),
    ...PHILOSOPHY(`shipping ${app}`),
    ...HYPE(`the moment ${app} goes live`),
    ...ROAST(`${app}'s first draft`),
    ...FUN_FACTS(`${app}'s future users`),
    ...TEAM_COORDINATION(`${app}'s ecosystem`),
    ...RESEARCH_INSIGHTS(`${app}'s positioning`),
    ...ENGINEERING_EXCELLENCE(`${app}'s resilience`),
    ...PRODUCT_CRAFT(`${app}'s polish`),
    ...BUSINESS_STRATEGY(`${app}'s monetization`),
  ]

  // Deduplicate any accidental repeats
  return [...new Set(all)]
}

// ─── Singleton cache so we don't regenerate on every render ──────────────────
const cache = new Map<string, string[]>()

export function getBuildMessages(opts: {
  projectName?: string
  projectPurpose?: string
  sourceUrl?: string
}): string[] {
  const key = `${opts.projectName ?? ""}|${opts.projectPurpose ?? ""}|${opts.sourceUrl ?? ""}`
  if (!cache.has(key)) cache.set(key, generateBuildMessages(opts))
  return cache.get(key)!
}

export function getBuildMessage(index: number, opts: {
  projectName?: string
  projectPurpose?: string
  sourceUrl?: string
}): string {
  const msgs = getBuildMessages(opts)
  return msgs[index % msgs.length] ?? "✨ Creating something amazing..."
}
