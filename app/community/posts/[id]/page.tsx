import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { PostDetailView } from "@/components/community/post-detail-view"
import { createClient } from "@/lib/supabase/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  try {
    // Fetch the post data
    const { data: post, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles:user_id (
          username,
          profile_picture_url
        )
      `)
      .eq("id", id)
      .single()

    if (error || !post) {
      return {
        title: "Post Not Found - TalkFlix",
        description: "This post could not be found.",
      }
    }

    // Get site settings
    const { data: settings } = await supabase.from("site_settings").select("site_title").single()

    const siteName = settings?.site_title || "ROCKFLIX"
    const username = post.profiles?.username || "Unknown User"

    // Extract first 60 characters of post content for title
    const postPreview = post.content
      ? post.content.substring(0, 60).trim() + (post.content.length > 60 ? "..." : "")
      : "TalkFlix Post"

    // Extract first 150 characters for description
    const description = post.content
      ? post.content.substring(0, 150).trim() + (post.content.length > 150 ? "..." : "")
      : `Post by ${username} on TalkFlix`

    const url = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.vercel.app"
    const postUrl = `${url}/community/posts/${id}`
    const profileImage = post.profiles?.profile_picture_url || `${url}/placeholder.svg?height=400&width=400`

    return {
      title: `${postPreview} - ${username} on TalkFlix`,
      description: description,
      openGraph: {
        title: `${postPreview}`,
        description: description,
        url: postUrl,
        siteName: `${siteName} - TalkFlix`,
        type: "article",
        images: [
          {
            url: profileImage,
            width: 1200,
            height: 630,
            alt: `Post by ${username}`,
          },
        ],
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title: `${postPreview}`,
        description: description,
        images: [profileImage],
        creator: `@${username}`,
      },
      alternates: {
        canonical: postUrl,
      },
    }
  } catch (error) {
    console.error("Error generating metadata for post:", error)
    return {
      title: "TalkFlix Post",
      description: "View this post on TalkFlix community",
    }
  }
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: post, error } = await supabase.from("posts").select("id").eq("id", id).single()

  if (error || !post) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TalkFlixHeader />
      <PostDetailView postId={id} />
    </div>
  )
}
