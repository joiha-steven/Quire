// Admin Newsletter page: subscribers + their send history, manual broadcast with a
// live preview, and the SMTP test sends. SMTP credentials stay in Settings →
// Integrations; this page is where you look at people and press send.
//
// Posts + their per-post send rollup are read here (server, live — the /admin layout
// forces no-store); subscribers are fetched client-side so the list stays current
// without a reload after a delete.
import { getPublicPosts } from '@/lib/posts'
import { statsByPost } from '@/lib/newsletter-log'
import { getMailStatus } from '@/lib/mail'
import { NewsletterView } from '@/components/admin/NewsletterView'

export const dynamic = 'force-dynamic'

export default async function AdminNewsletterPage() {
  const [posts, stats, mail] = await Promise.all([getPublicPosts(), statsByPost(), getMailStatus()])
  const rows = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    stats: stats.get(p.slug) ?? null,
  }))
  return <NewsletterView posts={rows} mailConfigured={mail.configured} />
}
