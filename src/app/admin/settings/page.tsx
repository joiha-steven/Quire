// Admin settings: general settings (incl. reader features), appearance, SEO —
// uniform cards in a two-column layout.
import { getSettings } from '@/lib/settings'
import { getPublicPosts } from '@/lib/posts'
import { THEME_PRESETS } from '@/lib/themes'
import { getCommentEnv } from '@/lib/comment-env'
import { getIntegrationStatus } from '@/lib/integration-keys'
import { SettingsView } from '@/components/admin/SettingsView'


export default async function SettingsPage() {
  const [settings, commentEnv, integrations, posts] = await Promise.all([
    getSettings(),
    getCommentEnv(),
    getIntegrationStatus(),
    getPublicPosts(), // published posts, for the Featured picker
  ])
  const postOptions = posts.map((p) => ({ slug: p.slug, title: p.title }))
  return <SettingsView settings={settings} presets={THEME_PRESETS} commentEnv={commentEnv} integrations={integrations} posts={postOptions} />
}
