// POST /api/media/blob-token -> issue a one-time client token so the BROWSER can
// upload an image straight to Vercel Blob (owner only). Direct upload bypasses the
// serverless 4.5MB request-body limit, so large photos no longer fail. The
// metadata row is written afterwards via /api/media/register (we don't rely on
// onUploadCompleted, which can't reach localhost).
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import type { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/api'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await requireOwner())) throw new Error('Unauthorized')
        return {
          allowedContentTypes: IMAGE_TYPES,
          addRandomSuffix: true, // unique pathname, no collisions
          maximumSizeInBytes: 50 * 1024 * 1024,
        }
      },
      // Metadata is registered by the client via /api/media/register; nothing to do.
      onUploadCompleted: async () => {},
    })
    return Response.json(json)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}
