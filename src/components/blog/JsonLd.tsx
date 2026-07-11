// Renders a JSON-LD structured-data block. Server component: the object is
// serialized once and emitted as a <script type="application/ld+json">.
// Callers gate rendering on settings.seo.autoSchema.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Schema.org JSON; escape '<' so it can never break out of the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

// WebSite schema for the home page.
export function websiteSchema(args: { name: string; url: string; description?: string }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: args.name,
    url: args.url,
    ...(args.description ? { description: args.description } : {}),
  }
}

// BreadcrumbList schema — the trail Google can show under a result (Home > Category > Post).
// Each item is an absolute URL; positions are 1-based.
export function breadcrumbSchema(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

// BlogPosting schema for a single post.
export function articleSchema(args: {
  title: string
  url: string
  datePublished: string
  description?: string
  image?: string
  authorName: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: args.title,
    url: args.url,
    mainEntityOfPage: args.url,
    datePublished: args.datePublished,
    dateModified: args.datePublished,
    ...(args.description ? { description: args.description } : {}),
    ...(args.image ? { image: args.image } : {}),
    author: { '@type': 'Person', name: args.authorName },
  }
}
