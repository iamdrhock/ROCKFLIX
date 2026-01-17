import { NextResponse } from "next/server"

import { adminRoute } from "@/lib/security/admin-middleware"
import { logModerationAction, updateUserReputation } from "@/lib/moderation"

// Use native Response to avoid NextResponse bundling issues
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

const ACTION_SEGMENTS = new Set(["flag", "reject", "approve", "unflag", "delete"])

function resolveCommentId(
  routeContext: { params?: Record<string, string | string[]> } | undefined,
  request: Request,
) {
  const raw = routeContext?.params?.commentId
  if (Array.isArray(raw)) return raw[0]
  if (typeof raw === "string" && raw) return raw

  try {
    const url = new URL(request.url)
    const queryId = url.searchParams.get("commentId")
    if (queryId) return queryId
    const parts = url.pathname.split("/").filter(Boolean).reverse()
    for (const segment of parts) {
      if (!ACTION_SEGMENTS.has(segment)) {
        return segment
      }
    }
    return null
  } catch {
    return null
  }
}

// Moderate a comment (approve, reject, flag)
export const PATCH = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const commentId = resolveCommentId(routeContext, request)
    if (!commentId) {
      return jsonResponse({ error: "Missing comment id" }, 400)
    }

    const body = await request.json()
    const { action, reason, moderator_id } = body // action: approve, reject, flag, unflag

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { queryContabo } = await import('@/lib/database/contabo-pool')
      const { 
        updateCommentModerationInContabo, 
        incrementProfileFieldContabo,
        updateUserReputationInContabo,
        logModerationActionInContabo
      } = await import('@/lib/database/contabo-writes')
      
      // Get the comment first
      const commentResult = await queryContabo<any>(
        'SELECT * FROM comments WHERE id = $1',
        [commentId]
      )

      if (commentResult.rows.length === 0) {
        return jsonResponse({ error: "Comment not found" }, 404)
      }

      const comment = commentResult.rows[0]
      const now = new Date().toISOString()

      let updates: any = {
        moderated_by: moderator_id,
        moderated_at: now,
      }

      if (action === "approve") {
        updates.moderation_status = "approved"
        updates.is_flagged = false
        updates.is_spam = false

        // Update user stats
        if (comment.user_id) {
          await incrementProfileFieldContabo(comment.user_id, 'comments_approved')
          await updateUserReputationInContabo(comment.user_id)
        }
      } else if (action === "reject") {
        updates.moderation_status = "rejected"
      } else if (action === "flag") {
        updates.is_flagged = true
        updates.flagged_by = moderator_id
        updates.flagged_at = now
        updates.flagged_reason = reason

        // Update user stats
        if (comment.user_id) {
          await incrementProfileFieldContabo(comment.user_id, 'comments_flagged')
          await updateUserReputationInContabo(comment.user_id)
        }
      } else if (action === "unflag") {
        updates.is_flagged = false
        updates.flagged_by = null
        updates.flagged_at = null
        updates.flagged_reason = null
      }

      await updateCommentModerationInContabo(commentId, updates)

      // Log the moderation action
      await logModerationActionInContabo(
        moderator_id, 
        `comment_${action}`, 
        "comment", 
        commentId, 
        reason || "No reason provided", 
        {
          comment_text: comment.comment_text || comment.comment,
          user_id: comment.user_id,
        }
      )

      return jsonResponse({ message: "Comment moderated successfully" })
    }

    // Fallback to Supabase
    // Get the comment first
    const { data: comment } = await supabase.from("comments").select("*").eq("id", commentId).single()

    if (!comment) {
      return jsonResponse({ error: "Comment not found" }, 404)
    }

    const updateData: Record<string, any> = {
      moderated_by: moderator_id,
      moderated_at: new Date().toISOString(),
    }

    if (action === "approve") {
      updateData.moderation_status = "approved"
      updateData.is_flagged = false
      updateData.is_spam = false

      // Update user stats
      if (comment.user_id) {
        await supabase.rpc("increment", {
          table_name: "profiles",
          row_id: comment.user_id,
          column_name: "comments_approved",
        })
        await updateUserReputation(comment.user_id)
      }
    } else if (action === "reject") {
      updateData.moderation_status = "rejected"
    } else if (action === "flag") {
      updateData.is_flagged = true
      updateData.flagged_by = moderator_id
      updateData.flagged_at = new Date().toISOString()
      updateData.flagged_reason = reason

      // Update user stats
      if (comment.user_id) {
        await supabase.rpc("increment", {
          table_name: "profiles",
          row_id: comment.user_id,
          column_name: "comments_flagged",
        })
        await updateUserReputation(comment.user_id)
      }
    } else if (action === "unflag") {
      updateData.is_flagged = false
      updateData.flagged_by = null
      updateData.flagged_at = null
      updateData.flagged_reason = null
    }

    const { error } = await supabase.from("comments").update(updateData).eq("id", commentId)

    if (error) {
      console.error("[v0] Error moderating comment:", error)
      return jsonResponse({ error: "Failed to moderate comment" }, 500)
    }

    // Log the moderation action
    await logModerationAction(moderator_id, `comment_${action}`, "comment", commentId, reason || "No reason provided", {
      comment_text: comment.comment_text,
      user_id: comment.user_id,
    })

    return jsonResponse({ message: "Comment moderated successfully" })
  } catch (error) {
    console.error("[v0] Error in comment moderation PATCH:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})

// Delete comment
export const DELETE = adminRoute(async ({ request, supabase }, routeContext) => {
  try {
    const commentId = resolveCommentId(routeContext, request)
    if (!commentId) {
      return jsonResponse({ error: "Missing comment id" }, 400)
    }

    // Use Contabo if enabled
    if (process.env.USE_CONTABO_DB === 'true') {
      const { deleteCommentFromContabo } = await import('@/lib/database/contabo-writes')
      await deleteCommentFromContabo(commentId)
      return jsonResponse({ message: "Comment deleted successfully" })
    }

    // Fallback to Supabase
    const { error } = await supabase.from("comments").delete().eq("id", commentId)

    if (error) {
      console.error("[v0] Error deleting comment:", error)
      return jsonResponse({ error: "Failed to delete comment" }, 500)
    }

    return jsonResponse({ message: "Comment deleted successfully" })
  } catch (error) {
    console.error("[v0] Error in comment DELETE:", error)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
