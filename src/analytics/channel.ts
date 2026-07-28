// Traffic-channel classification, ported from the `analytics_channel(host)` plpgsql
// function. The three regexes are copied verbatim from the migration so a visitor that
// counted as "search" yesterday still counts as "search" tomorrow; the only change is
// Postgres `~*` becoming a JavaScript case-insensitive test.
//
// Pure and dependency-free, which is the point: the classification was the one part of
// the SQL function with judgement in it, and it is now directly testable.

export type Channel = 'direct' | 'search' | 'social' | 'referral'

const SEARCH = /google\.|bing\.|yahoo\.|duckduckgo|yandex|baidu|ecosia\.|brave\.|startpage|search\./i
const SOCIAL = /facebook|fb\.com|instagram|twitter|(^|\.)x\.com|t\.co|linkedin|reddit|youtu|pinterest|tiktok|threads\.net|mastodon|telegram|t\.me|whatsapp|(^|\.)vk\.com/i

/** No referrer host means the visitor typed the URL or came from inside the site. */
export function channelOf(host: string | null | undefined): Channel {
  if (!host) return 'direct'
  if (SEARCH.test(host)) return 'search'
  if (SOCIAL.test(host)) return 'social'
  return 'referral'
}
