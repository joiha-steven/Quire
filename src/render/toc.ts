// In-page anchor ids the post ToC jumps to, set on the matching blocks in the
// post page. Kept in a plain (non-'use client') module so BOTH the Server
// Component page and the client `Toc` import the real values: importing a plain
// const from a 'use client' module into a Server Component yields a client
// reference proxy whose props read as `undefined`, which rendered `href="#undefined"`
// and `id="undefined"` and broke the jump.
export const TOC_ANCHORS = { tags: 'post-tags', categories: 'post-categories', comments: 'post-comments' }
