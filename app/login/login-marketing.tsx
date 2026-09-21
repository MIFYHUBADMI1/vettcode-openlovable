import { AuthVisual } from "@/components/auth/auth-visual"

export function LoginMarketing() {
  return (
    <AuthVisual
      eyebrow="Welcome back"
      heading="Continue the work you already started."
      body="Sign in to open your businesses, review plans, and pick up in the workspace — without the pitch."
      primary={{
        src: "/landing-images/atai-workspace.png",
        alt: "Atai home workspace with businesses and AI collaboration",
      }}
      secondary={{
        src: "/landing-images/atai-project-workspace.png",
        alt: "Atai project workspace",
      }}
    />
  )
}
