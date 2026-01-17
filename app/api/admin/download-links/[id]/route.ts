import { type NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

// PATCH - Update download link
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params
    const id = Number.parseInt(paramId, 10)

    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid download link ID" }, { status: 400 })
    }

    const body = await request.json()
    const { quality, format, link_url, provider, file_size, status } = body

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { updateDownloadLinkInContabo } = await import('@/lib/database/contabo-writes')
        console.log(`[admin/download-links/:id] PATCH - Updating download link ${id} in Contabo`)
        
        const data = await updateDownloadLinkInContabo(id, {
          quality,
          format,
          link_url,
          provider,
          file_size,
          status,
        })
        
        console.log(`[admin/download-links/:id] PATCH - Successfully updated download link ${id}`)
        return NextResponse.json({ success: true, data })
      } catch (contaboError: any) {
        console.error("[admin/download-links/:id] Contabo error:", contaboError)
        if (contaboError.message === 'Download link not found') {
          return NextResponse.json({ error: "Download link not found" }, { status: 404 })
        }
        return NextResponse.json({ 
          error: "Failed to update download link",
          details: contaboError.message 
        }, { status: 500 })
      }
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (quality) updateData.quality = quality
    if (format) updateData.format = format
    if (link_url) updateData.link_url = link_url
    if (provider !== undefined) updateData.provider = provider
    if (file_size !== undefined) updateData.file_size = file_size
    if (status) updateData.status = status

    const { data, error } = await supabase.from("download_links").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("[v0] Error updating download link:", error)
      return NextResponse.json({ error: "Failed to update download link" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error in download link PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove download link
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params
    const id = Number.parseInt(paramId, 10)

    if (Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid download link ID" }, { status: 400 })
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      try {
        const { deleteDownloadLinkFromContabo } = await import('@/lib/database/contabo-writes')
        console.log(`[admin/download-links/:id] DELETE - Deleting download link ${id} from Contabo`)
        
        await deleteDownloadLinkFromContabo(id)
        
        console.log(`[admin/download-links/:id] DELETE - Successfully deleted download link ${id}`)
        return NextResponse.json({ success: true, message: "Download link deleted successfully" })
      } catch (contaboError: any) {
        console.error("[admin/download-links/:id] Contabo error:", contaboError)
        if (contaboError.message === 'Download link not found') {
          return NextResponse.json({ error: "Download link not found" }, { status: 404 })
        }
        return NextResponse.json({ 
          error: "Failed to delete download link",
          details: contaboError.message 
        }, { status: 500 })
      }
    }

    // Fallback to Supabase
    const supabase = createServiceRoleClient()

    const { error } = await supabase.from("download_links").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting download link:", error)
      return NextResponse.json({ error: "Failed to delete download link" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Download link deleted successfully" })
  } catch (error) {
    console.error("[v0] Error in download link DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
