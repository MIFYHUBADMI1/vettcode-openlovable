import { AuthVisual } from "@/components/auth/auth-visual"

export function RegisterMarketing() {
  return (
    <AuthVisual
      eyebrow="Start with Atai"
      heading="Turn an idea into a working product."
      body="Create an account, describe what you want to build, and review a plan before anything goes live. New accounts start with 500 credits. No credit card required."
      primary={{
        src: "/landing-images/atai-product.png",
        alt: "Atai product editor showing pages and a live application",
      }}
      secondary={{
        src: "/landing-images/atai-growth.png",
        alt: "Atai growth and launch view",
      }}
    />
  )
}
