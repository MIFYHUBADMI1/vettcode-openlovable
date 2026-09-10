import { redirect } from "next/navigation"

/** `/workspace` and `/dashboard` used to be two separate home pages that
 * duplicated the "create a project" flow. `/dashboard` is now the single
 * canonical home — this route stays only so old links and bookmarks keep
 * working. */
export default function WorkspacePage() {
  redirect("/dashboard")
}
