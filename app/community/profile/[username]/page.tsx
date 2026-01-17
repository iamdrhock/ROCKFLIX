import { TalkFlixProfilePage } from "@/components/community/talkflix-profile-page"
import { TalkFlixHeader } from "@/components/community/talkflix-header"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { 
  fetchProfileByUsernameFromContabo,
  fetchUserPostsFromContabo,
  getFollowersCountFromContabo,
  getFollowingCountFromContabo,
  checkFollowStatusFromContabo
} from "@/lib/database/contabo-queries"
import { fetchSiteSettingsFromContabo } from "@/lib/database/contabo-queries"

interface PageProps {
  params: Promise<{
    username: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params

  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    const supabase = await createClient()

    // Fetch profile data
    let profile: any = null
    if (useContabo) {
      profile = await fetchProfileByUsernameFromContabo(username)
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, profile_picture_url, about, created_at")
        .eq("username", username)
        .single()
      profile = data
    }

    if (!profile) {
      return {
        title: "Profile Not Found - TalkFlix",
        description: "This profile could not be found.",
      }
    }

    // Get site settings
    let siteName = "ROCKFLIX"
    if (useContabo) {
      const settings = await fetchSiteSettingsFromContabo()
      siteName = settings?.site_title || "ROCKFLIX"
    } else {
      const { data: settings } = await supabase.from("site_settings").select("site_title").single()
      siteName = settings?.site_title || "ROCKFLIX"
    }

    // Get posts count
    let postsCount = 0
    if (useContabo) {
      const posts = await fetchUserPostsFromContabo(profile.id, 1)
      postsCount = posts.length
    } else {
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
      postsCount = count || 0
    }

    // Get followers count
    let followersCount = 0
    if (useContabo) {
      followersCount = await getFollowersCountFromContabo(profile.id)
    } else {
      const { count } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id)
      followersCount = count || 0
    }

    const bio = profile.about
      ? profile.about.substring(0, 150).trim() + (profile.about.length > 150 ? "..." : "")
      : `${username} is an active member of the TalkFlix community with ${postsCount || 0} posts and ${followersCount || 0} followers.`

    const url = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.vercel.app"
    const profileUrl = `${url}/community/profile/${username}`
    const profileImage = profile.profile_picture_url || `${url}/placeholder.svg?height=400&width=400`

    return {
      title: `${username} (@${username}) - TalkFlix Profile`,
      description: bio,
      openGraph: {
        title: `${username} on TalkFlix`,
        description: bio,
        url: profileUrl,
        siteName: `${siteName} - TalkFlix`,
        type: "profile",
        images: [
          {
            url: profileImage,
            width: 1200,
            height: 630,
            alt: `${username}'s profile picture`,
          },
        ],
        locale: "en_US",
      },
      twitter: {
        card: "summary",
        title: `${username} (@${username})`,
        description: bio,
        images: [profileImage],
        creator: `@${username}`,
      },
      alternates: {
        canonical: profileUrl,
      },
    }
  } catch (error) {
    console.error("Error generating metadata for profile:", error)
    return {
      title: `${username} - TalkFlix Profile`,
      description: `View ${username}'s profile, posts, and activity on TalkFlix community`,
    }
  }
}

export default async function TalkFlixUserProfilePage({ params }: PageProps) {
  const { username } = await params
  const supabase = await createClient()
  const useContabo = process.env.USE_CONTABO_DB === 'true'

  console.log("[v0] === TalkFlix Profile Page Debug Start ===")
  console.log("[v0] Fetching profile for username:", username)

  // Fetch profile data
  let profile: any = null
  if (useContabo) {
    profile = await fetchProfileByUsernameFromContabo(username)
  } else {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single()
    profile = data
    console.log("[v0] Profile result:", {
      found: !!profile,
      profileId: profile?.id,
      error: profileError?.message,
    })
  }

  if (!profile) {
    notFound()
  }

  // Get current user
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  console.log("[v0] Current user:", currentUser?.id)
  console.log("[v0] Fetching posts for user_id:", profile.id)

  // Fetch posts
  let posts: any[] = []
  if (useContabo) {
    const postsData = await fetchUserPostsFromContabo(profile.id, 50)
    posts = postsData.map((post) => ({
      ...post,
      profiles: profile,
    }))
  } else {
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })

    console.log("[v0] Posts query result:", {
      totalPosts: postsData?.length || 0,
      error: postsError?.message,
    })

    posts = (postsData || []).map((post) => ({
      ...post,
      profiles: profile,
    }))
  }

  console.log("[v0] After mapping profile data to posts:", posts.length)

  // Fetch followers/following counts
  let followersCount = 0
  let followingCount = 0
  if (useContabo) {
    followersCount = await getFollowersCountFromContabo(profile.id)
    followingCount = await getFollowingCountFromContabo(profile.id)
  } else {
    const { count: followers } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id)
    followersCount = followers || 0

    const { count: following } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id)
    followingCount = following || 0
  }

  // Check if current user follows this profile
  let isFollowing = false
  if (currentUser) {
    if (useContabo) {
      isFollowing = await checkFollowStatusFromContabo(currentUser.id, profile.id)
    } else {
      const { data: followData } = await supabase
        .from("user_follows")
        .select("*")
        .eq("follower_id", currentUser.id)
        .eq("following_id", profile.id)
        .single()
      isFollowing = !!followData
    }
  }

  const isOwnProfile = currentUser?.id === profile.id

  console.log("[v0] Final data:", {
    postsCount: posts.length,
    followersCount,
    followingCount,
    isOwnProfile,
  })
  console.log("[v0] === TalkFlix Profile Page Debug End ===")

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <TalkFlixHeader />
      <main className="flex-1">
        <TalkFlixProfilePage
          username={username}
          initialProfile={profile}
          initialPosts={posts}
          initialFollowersCount={followersCount || 0}
          initialFollowingCount={followingCount || 0}
          initialIsFollowing={isFollowing}
          isOwnProfile={isOwnProfile}
          currentUserId={currentUser?.id || null}
        />
      </main>
    </div>
  )
}
