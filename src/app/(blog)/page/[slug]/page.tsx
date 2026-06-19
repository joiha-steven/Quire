// Static page detail. Drafts are not publicly reachable. No date/taxonomy.
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPage } from '@/lib/pages'
import { PostContent } from '@/components/blog/PostContent'

export const dynamic = 'force-dynamic'

export default async function StaticPage({ params }: PageProps<'/page/[slug]'>) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page || page.status !== 'published') notFound()

  const full = page.imageDisplay === 'full' && page.featuredImage

  return (
    <article>
      {full && (
        <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2">
          {/* Full-bleed image: a plain img spans the viewport at native size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.featuredImage} alt={page.title} className="h-auto w-full" />
        </div>
      )}

      <h1 className="text-3xl font-bold leading-tight tracking-tight">{page.title}</h1>

      {!full && page.featuredImage && (
        <Image
          src={page.featuredImage}
          alt={page.title}
          width={1280}
          height={720}
          className="mt-8 h-auto w-full rounded-lg"
          unoptimized
        />
      )}

      <div className="mt-8">
        <PostContent markdown={page.content} />
      </div>
    </article>
  )
}
