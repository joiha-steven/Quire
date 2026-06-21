// POST /api/files/blob-token -> issue a one-time client token so the BROWSER can
// upload an attachment straight to Vercel Blob (owner only). Any content type
// (catch-all store). Direct upload bypasses the serverless 4.5MB body limit;
// metadata is written afterwards via /api/files/register.
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import type { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/api'

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await requireOwner())) throw new Error('Unauthorized')
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 500 * 1024 * 1024,
        }
      },
      onUploadCompleted: async () => {},
    })
    return Response.json(json)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}
