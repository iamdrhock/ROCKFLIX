import { transporter, DEFAULT_FROM_EMAIL } from "./smtp-client"
import { createClient } from "@/lib/supabase/server"
import { NewEpisodeEmail } from "./templates/new-episode"
import { CommentReplyEmail } from "./templates/comment-reply"
import { WeeklyDigestEmail } from "./templates/weekly-digest"
import { renderToString } from "react-dom/server"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

interface SendNewEpisodeEmailParams {
  userId: string
  seriesId: number
  seriesTitle: string
  seasonNumber: number
  episodeNumber: number
  episodeTitle: string
  episodePosterUrl?: string
}

export async function sendNewEpisodeEmail(params: SendNewEpisodeEmailParams) {
  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    const supabase = await createClient()

    // Get user email and notification preferences
    let profile: { username: string; email: string } | null = null
    if (useContabo) {
      profile = await fetchUserProfileWithEmailFromContabo(params.userId)
    } else {
      const { data } = await supabase.from("profiles").select("username, email").eq("id", params.userId).single()
      profile = data
    }

    if (!profile?.email) {
      console.error("[v0] User email not found")
      return { success: false, error: "User email not found" }
    }

    // Check notification preferences
    let preferences: { email_new_episodes?: boolean } | null = null
    if (useContabo) {
      const prefs = await fetchNotificationPreferencesFromContabo(params.userId)
      preferences = prefs
    } else {
      const { data } = await supabase
        .from("notification_preferences")
        .select("email_new_episodes")
        .eq("user_id", params.userId)
        .single()
      preferences = data
    }

    if (preferences && !preferences.email_new_episodes) {
      console.log("[v0] User has disabled new episode notifications")
      return { success: false, error: "User has disabled notifications" }
    }

    // Render email template
    const emailHtml = renderToString(
      NewEpisodeEmail({
        username: profile.username,
        seriesTitle: params.seriesTitle,
        seasonNumber: params.seasonNumber,
        episodeNumber: params.episodeNumber,
        episodeTitle: params.episodeTitle,
        seriesId: params.seriesId,
        episodePosterUrl: params.episodePosterUrl,
        siteUrl: SITE_URL,
      }),
    )

    // Send email via Nodemailer
    const info = await transporter.sendMail({
      from: DEFAULT_FROM_EMAIL,
      to: profile.email,
      subject: `New Episode: ${params.seriesTitle} - S${params.seasonNumber}E${params.episodeNumber}`,
      html: emailHtml,
    })

    if (!info.messageId) {
      console.error("[v0] Error sending email: No message ID returned")

      // Log failed email
      if (useContabo) {
        await logEmailNotificationInContabo({
          user_id: params.userId,
          notification_type: "new_episode",
          email_address: profile.email,
          subject: `New Episode: ${params.seriesTitle}`,
          movie_id: params.seriesId,
          status: "failed",
          error_message: "Failed to send email",
        })
      } else {
        await supabase.from("email_notifications_log").insert({
          user_id: params.userId,
          notification_type: "new_episode",
          email_address: profile.email,
          subject: `New Episode: ${params.seriesTitle}`,
          movie_id: params.seriesId,
          status: "failed",
          error_message: "Failed to send email",
        })
      }

      return { success: false, error: "Failed to send email" }
    }

    // Log successful email
    if (useContabo) {
      await logEmailNotificationInContabo({
        user_id: params.userId,
        notification_type: "new_episode",
        email_address: profile.email,
        subject: `New Episode: ${params.seriesTitle}`,
        content_preview: `${params.episodeTitle}`,
        movie_id: params.seriesId,
        status: "sent",
      })
    } else {
      await supabase.from("email_notifications_log").insert({
        user_id: params.userId,
        notification_type: "new_episode",
        email_address: profile.email,
        subject: `New Episode: ${params.seriesTitle}`,
        content_preview: `${params.episodeTitle}`,
        movie_id: params.seriesId,
        status: "sent",
      })
    }

    return { success: true, data: info }
  } catch (error) {
    console.error("[v0] Error in sendNewEpisodeEmail:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

interface SendCommentReplyEmailParams {
  recipientUserId: string
  replierUserId: string
  movieId: number
  movieTitle: string
  originalCommentId: number
  originalComment: string
  replyComment: string
}

export async function sendCommentReplyEmail(params: SendCommentReplyEmailParams) {
  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    const supabase = await createClient()

    // Get recipient email and notification preferences
    let recipientProfile: { username: string; email: string } | null = null
    if (useContabo) {
      recipientProfile = await fetchUserProfileWithEmailFromContabo(params.recipientUserId)
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", params.recipientUserId)
        .single()
      recipientProfile = data
    }

    if (!recipientProfile?.email) {
      return { success: false, error: "Recipient email not found" }
    }

    // Check notification preferences
    let preferences: { email_comment_replies?: boolean } | null = null
    if (useContabo) {
      const prefs = await fetchNotificationPreferencesFromContabo(params.recipientUserId)
      preferences = prefs
    } else {
      const { data } = await supabase
        .from("notification_preferences")
        .select("email_comment_replies")
        .eq("user_id", params.recipientUserId)
        .single()
      preferences = data
    }

    if (preferences && !preferences.email_comment_replies) {
      return { success: false, error: "User has disabled comment reply notifications" }
    }

    // Get replier username
    let replierProfile: { username: string } | null = null
    if (useContabo) {
      const replier = await fetchUserProfileWithEmailFromContabo(params.replierUserId)
      replierProfile = replier ? { username: replier.username } : null
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", params.replierUserId)
        .single()
      replierProfile = data
    }

    // Render email template
    const emailHtml = renderToString(
      CommentReplyEmail({
        username: recipientProfile.username,
        replierUsername: replierProfile?.username || "Someone",
        movieTitle: params.movieTitle,
        movieId: params.movieId,
        originalComment: params.originalComment,
        replyComment: params.replyComment,
        siteUrl: SITE_URL,
      }),
    )

    // Send email via Nodemailer
    const info = await transporter.sendMail({
      from: DEFAULT_FROM_EMAIL,
      to: recipientProfile.email,
      subject: `${replierProfile?.username || "Someone"} replied to your comment`,
      html: emailHtml,
    })

    if (!info.messageId) {
      console.error("[v0] Error sending email: No message ID returned")

      if (useContabo) {
        await logEmailNotificationInContabo({
          user_id: params.recipientUserId,
          notification_type: "comment_reply",
          email_address: recipientProfile.email,
          subject: "New reply to your comment",
          movie_id: params.movieId,
          comment_id: params.originalCommentId,
          status: "failed",
          error_message: "Failed to send email",
        })
      } else {
        await supabase.from("email_notifications_log").insert({
          user_id: params.recipientUserId,
          notification_type: "comment_reply",
          email_address: recipientProfile.email,
          subject: "New reply to your comment",
          movie_id: params.movieId,
          comment_id: params.originalCommentId,
          status: "failed",
          error_message: "Failed to send email",
        })
      }

      return { success: false, error: "Failed to send email" }
    }

    // Log successful email
    if (useContabo) {
      await logEmailNotificationInContabo({
        user_id: params.recipientUserId,
        notification_type: "comment_reply",
        email_address: recipientProfile.email,
        subject: "New reply to your comment",
        content_preview: params.replyComment.substring(0, 100),
        movie_id: params.movieId,
        comment_id: params.originalCommentId,
        status: "sent",
      })
    } else {
      await supabase.from("email_notifications_log").insert({
        user_id: params.recipientUserId,
        notification_type: "comment_reply",
        email_address: recipientProfile.email,
        subject: "New reply to your comment",
        content_preview: params.replyComment.substring(0, 100),
        movie_id: params.movieId,
        comment_id: params.originalCommentId,
        status: "sent",
      })
    }

    return { success: true, data: info }
  } catch (error) {
    console.error("[v0] Error in sendCommentReplyEmail:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function sendWeeklyDigestEmail(userId: string) {
  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    const supabase = await createClient()

    // Get user email and preferences
    let profile: { username: string; email: string } | null = null
    if (useContabo) {
      profile = await fetchUserProfileWithEmailFromContabo(userId)
    } else {
      const { data } = await supabase.from("profiles").select("username, email").eq("id", userId).single()
      profile = data
    }

    if (!profile?.email) {
      return { success: false, error: "User email not found" }
    }

    // Check notification preferences
    let preferences: { email_weekly_digest?: boolean; digest_frequency?: string } | null = null
    if (useContabo) {
      const prefs = await fetchNotificationPreferencesFromContabo(userId)
      preferences = prefs
    } else {
      const { data } = await supabase
        .from("notification_preferences")
        .select("email_weekly_digest, digest_frequency")
        .eq("user_id", userId)
        .single()
      preferences = data
    }

    if (preferences && (!preferences.email_weekly_digest || preferences.digest_frequency === "never")) {
      return { success: false, error: "User has disabled weekly digest" }
    }

    // Get new movies from the past week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    let newMovies: any[] = []
    let newSeries: any[] = []

    if (useContabo) {
      newMovies = await fetchNewContentFromPastWeekFromContabo("movie", 10)
      newSeries = await fetchNewContentFromPastWeekFromContabo("series", 10)
    } else {
      const { data: movies } = await supabase
        .from("movies")
        .select("id, title, poster_url, type, release_date")
        .eq("type", "movie")
        .gte("created_at", oneWeekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10)
      newMovies = movies || []

      const { data: series } = await supabase
        .from("movies")
        .select("id, title, poster_url, type, release_date")
        .eq("type", "series")
        .gte("created_at", oneWeekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10)
      newSeries = series || []
    }

    // If no new content, skip email
    if ((!newMovies || newMovies.length === 0) && (!newSeries || newSeries.length === 0)) {
      return { success: false, error: "No new content this week" }
    }

    // Format week range
    const weekRange = `${oneWeekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

    // Render email template
    const emailHtml = renderToString(
      WeeklyDigestEmail({
        username: profile.username,
        newMovies: newMovies || [],
        newSeries: newSeries || [],
        weekRange,
        siteUrl: SITE_URL,
      }),
    )

    // Send email via Nodemailer
    const info = await transporter.sendMail({
      from: DEFAULT_FROM_EMAIL,
      to: profile.email,
      subject: `Your Weekly Digest - ${newMovies?.length || 0} New Movies, ${newSeries?.length || 0} New Series`,
      html: emailHtml,
    })

    if (!info.messageId) {
      console.error("[v0] Error sending email: No message ID returned")

      if (useContabo) {
        await logEmailNotificationInContabo({
          user_id: userId,
          notification_type: "weekly_digest",
          email_address: profile.email,
          subject: "Your Weekly Digest",
          status: "failed",
          error_message: "Failed to send email",
        })
      } else {
        await supabase.from("email_notifications_log").insert({
          user_id: userId,
          notification_type: "weekly_digest",
          email_address: profile.email,
          subject: "Your Weekly Digest",
          status: "failed",
          error_message: "Failed to send email",
        })
      }

      return { success: false, error: "Failed to send email" }
    }

    // Log successful email and update last sent timestamp
    if (useContabo) {
      await Promise.all([
        logEmailNotificationInContabo({
          user_id: userId,
          notification_type: "weekly_digest",
          email_address: profile.email,
          subject: "Your Weekly Digest",
          content_preview: `${newMovies?.length || 0} new movies, ${newSeries?.length || 0} new series`,
          status: "sent",
        }),
        updateLastDigestSentInContabo(userId),
      ])
    } else {
      await Promise.all([
        supabase.from("email_notifications_log").insert({
          user_id: userId,
          notification_type: "weekly_digest",
          email_address: profile.email,
          subject: "Your Weekly Digest",
          content_preview: `${newMovies?.length || 0} new movies, ${newSeries?.length || 0} new series`,
          status: "sent",
        }),
        supabase
          .from("notification_preferences")
          .update({ last_digest_sent_at: new Date().toISOString() })
          .eq("user_id", userId),
      ])
    }

    return { success: true, data: info }
  } catch (error) {
    console.error("[v0] Error in sendWeeklyDigestEmail:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
