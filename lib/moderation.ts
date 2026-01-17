import { createServiceRoleClient } from "./supabase/server"
import { fetchSpamPatternsFromContabo } from "./database/contabo-queries"

export interface SpamCheckResult {
  isSpam: boolean
  spamScore: number
  reasons: string[]
}

export async function checkSpam(text: string): Promise<SpamCheckResult> {
  const useContabo = process.env.USE_CONTABO_DB === 'true'
  
  let patterns: any[] = []

  if (useContabo) {
    patterns = await fetchSpamPatternsFromContabo()
  } else {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("spam_patterns")
      .select("pattern, pattern_type, severity")
      .eq("is_active", true)
    patterns = data || []
  }

  let spamScore = 0
  const reasons: string[] = []

  if (patterns) {
    for (const pattern of patterns) {
      const lowerText = text.toLowerCase()
      const lowerPattern = pattern.pattern.toLowerCase()

      if (lowerText.includes(lowerPattern)) {
        spamScore += pattern.severity
        reasons.push(`Contains spam keyword: ${pattern.pattern}`)
      }
    }
  }

  // Additional heuristics
  const urlCount = (text.match(/https?:\/\//g) || []).length
  if (urlCount > 3) {
    spamScore += 10
    reasons.push("Too many URLs")
  }

  const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length
  if (upperCaseRatio > 0.5 && text.length > 20) {
    spamScore += 5
    reasons.push("Excessive caps")
  }

  if (text.length < 5) {
    spamScore += 3
    reasons.push("Very short comment")
  }

  // Check for repeated characters
  if (/(.)\1{4,}/.test(text)) {
    spamScore += 5
    reasons.push("Repeated characters")
  }

  return {
    isSpam: spamScore >= 15,
    spamScore,
    reasons,
  }
}

export async function updateUserReputation(userId: string) {
  const useContabo = process.env.USE_CONTABO_DB === 'true'

  if (useContabo) {
    const { updateUserReputationInContabo } = await import('./database/contabo-writes')
    await updateUserReputationInContabo(userId)
  } else {
    const supabase = createServiceRoleClient()

    const { data: profile } = await supabase
      .from("profiles")
      .select("comments_approved, comments_flagged")
      .eq("id", userId)
      .single()

    if (profile) {
      const reputationScore = profile.comments_approved * 10 - profile.comments_flagged * 20

      await supabase.from("profiles").update({ reputation_score: reputationScore }).eq("id", userId)
    }
  }
}

export async function logModerationAction(
  moderatorId: string,
  action: string,
  targetType: "user" | "comment",
  targetId: string,
  reason: string,
  details?: Record<string, any>,
) {
  const useContabo = process.env.USE_CONTABO_DB === 'true'

  if (useContabo) {
    const { logModerationActionInContabo } = await import('./database/contabo-writes')
    await logModerationActionInContabo({
      moderatorId,
      action,
      targetType,
      targetId,
      reason,
      details,
    })
  } else {
    const supabase = createServiceRoleClient()

    await supabase.from("moderation_logs").insert({
      moderator_id: moderatorId,
      action,
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
    })
  }
}

export async function checkUserCanComment(userId: string): Promise<{ canComment: boolean; reason?: string }> {
  const useContabo = process.env.USE_CONTABO_DB === 'true'

  if (useContabo) {
    const { getUserProfileForModerationFromContabo } = await import('./database/contabo-queries')
    const { unmuteUserInContabo } = await import('./database/contabo-writes')
    const profile = await getUserProfileForModerationFromContabo(userId)

    if (!profile) {
      return { canComment: false, reason: "User not found" }
    }

    if (profile.is_banned) {
      return { canComment: false, reason: `You are banned: ${profile.banned_reason || "No reason provided"}` }
    }

    if (profile.is_muted) {
      if (profile.muted_until && new Date(profile.muted_until) > new Date()) {
        return {
          canComment: false,
          reason: `You are muted until ${new Date(profile.muted_until).toLocaleDateString()}`,
        }
      } else {
        // Mute expired, unmute user
        await unmuteUserInContabo(userId)
      }
    }

    return { canComment: true }
  } else {
    const supabase = createServiceRoleClient()

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned, banned_reason, is_muted, muted_until")
      .eq("id", userId)
      .single()

    if (!profile) {
      return { canComment: false, reason: "User not found" }
    }

    if (profile.is_banned) {
      return { canComment: false, reason: `You are banned: ${profile.banned_reason || "No reason provided"}` }
    }

    if (profile.is_muted) {
      if (profile.muted_until && new Date(profile.muted_until) > new Date()) {
        return {
          canComment: false,
          reason: `You are muted until ${new Date(profile.muted_until).toLocaleDateString()}`,
        }
      } else {
        // Mute expired, unmute user
        await supabase
          .from("profiles")
          .update({ is_muted: false, muted_until: null, muted_reason: null })
          .eq("id", userId)
      }
    }

    return { canComment: true }
  }
}
