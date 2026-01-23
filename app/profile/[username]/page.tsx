import { notFound, redirect } from "next/navigation"
import { createClient as createServerClient } from "@/lib/supabase/server"
import Image from "next/image"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Calendar, MapPin, Shield, Bookmark, MessageSquare, Heart, Repeat2 } from "lucide-react"
import { MovieCard } from "@/components/movie-card"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  fetchProfileByUsernameFromContabo,
  fetchUserPostsFromContabo,
  getFollowersCountFromContabo,
  getFollowingCountFromContabo,
  fetchUserFavoritesFromContabo
} from "@/lib/database/contabo-queries"
import { fetchSiteSettingsFromContabo } from "@/lib/database/contabo-queries"

interface ProfilePageProps {
  params: Promise<{
    username: string
  }>
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { username } = await params

  // Handle reserved routes that might be caught by this dynamic route
  // This fixes the "Profile Not Found" error when accessing /profile/watchlist
  if (['watchlist', 'my-watchlist'].includes(username.toLowerCase())) {
    redirect('/profile/my-watchlist')
  }
  if (['favorites', 'my-favorites'].includes(username.toLowerCase())) {
    redirect('/profile/my-favorites')
  }

  const supabase = await createServerClient()
  const useContabo = process.env.USE_CONTABO_DB === 'true'

  // Fetch the user's profile by username
  let profile: any = null
  if (useContabo) {
    profile = await fetchProfileByUsernameFromContabo(username)
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, profile_picture_url, country, role, created_at, about")
      .eq("username", username)
      .single()
    profile = data
    if (error || !profile) {
      notFound()
    }
  }

  if (!profile) {
    notFound()
  }

  // Get posts count
  let postsCount = 0
  let recentPosts: any[] = []
  if (useContabo) {
    const posts = await fetchUserPostsFromContabo(profile.id, 10)
    postsCount = posts.length
    recentPosts = posts.slice(0, 10)
  } else {
    const { data: communityStats } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
    postsCount = communityStats?.count || 0

    const { data: posts } = await supabase
      .from("posts")
      .select("id, content, created_at, likes_count, comments_count, repost_count")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10)
    recentPosts = posts || []
  }

  // Get followers/following counts
  let followersCount = 0
  let followingCount = 0
  if (useContabo) {
    followersCount = await getFollowersCountFromContabo(profile.id)
    followingCount = await getFollowingCountFromContabo(profile.id)
  } else {
    const { data: followersData } = await supabase
      .from("user_follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profile.id)
    followersCount = followersData?.count || 0

    const { data: followingData } = await supabase
      .from("user_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", profile.id)
    followingCount = followingData?.count || 0
  }

  // Get favorites
  let favorites: any[] = []
  if (useContabo) {
    favorites = await fetchUserFavoritesFromContabo(profile.id, 12)
  } else {
    const { data: favoritesData } = await supabase
      .from("favorites")
      .select(`
        id,
        movie_id,
        created_at,
        movies (
          id,
          title,
          poster_url,
          type,
          rating,
          release_date,
          quality
        )
      `)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(12)
    favorites = favoritesData?.map((item: any) => item.movies).filter(Boolean) || []
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-6xl py-12 px-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-24">
              <div className="flex justify-center">
                {profile.profile_picture_url ? (
                  <Image
                    src={profile.profile_picture_url || "/placeholder.svg"}
                    alt={profile.username}
                    width={150}
                    height={150}
                    className="rounded-full border-4 border-background object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-[150px] w-[150px] items-center justify-center rounded-full border-4 border-background bg-primary text-6xl font-bold text-primary-foreground shadow-lg">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="text-center">
                <h1 className="text-4xl font-bold mb-2">{profile.username}</h1>

                <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-muted-foreground">
                  {profile.country && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      <span className="text-sm font-medium">{profile.country}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <span className="text-sm font-medium capitalize">{profile.role}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Joined{" "}
                      {new Date(profile.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-8 mt-6 pt-6 border-t">
                  <Link href={`/community/profile/${profile.username}`} className="text-center hover:underline">
                    <div className="text-2xl font-bold">{postsCount}</div>
                    <div className="text-sm text-muted-foreground">TalkFlix Posts</div>
                  </Link>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{followersCount}</div>
                    <div className="text-sm text-muted-foreground">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{followingCount}</div>
                    <div className="text-sm text-muted-foreground">Following</div>
                  </div>
                </div>
              </div>

              <div className="mt-12 border-t pt-8">
                <h2 className="text-xl font-semibold mb-4">About</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {profile.about || `${profile.username} is a member of our community.`}
                </p>
              </div>

              {recentPosts && recentPosts.length > 0 && (
                <div className="mt-12 border-t pt-8">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Recent TalkFlix Posts</h2>
                  </div>
                  <div className="space-y-4">
                    {recentPosts.map((post: any) => (
                      <Link
                        key={post.id}
                        href={`/community#post-${post.id}`}
                        className="block p-4 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <p className="text-sm line-clamp-3 mb-3">{post.content}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {post.likes_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {post.comments_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Repeat2 className="h-3 w-3" />
                            {post.repost_count}
                          </span>
                          <span className="ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <Link href={`/community/profile/${profile.username}`}>
                      <Button variant="outline">View All TalkFlix Posts</Button>
                    </Link>
                  </div>
                </div>
              )}

              {favorites.length > 0 && (
                <div className="mt-12 border-t pt-8">
                  <div className="flex items-center gap-2 mb-6">
                    <Bookmark className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Favorites</h2>
                    <span className="text-muted-foreground">({favorites.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {favorites.map((movie: any) => (
                      <MovieCard key={movie.id} movie={movie} />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = await params

  try {
    const useContabo = process.env.USE_CONTABO_DB === 'true'
    const supabase = await createServerClient()

    // Fetch profile data
    let profile: any = null
    if (useContabo) {
      profile = await fetchProfileByUsernameFromContabo(username)
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, profile_picture_url, about, country, role, created_at")
        .eq("username", username)
        .single()
      profile = data
    }

    if (!profile) {
      return {
        title: "Profile Not Found",
        description: "This profile could not be found.",
      }
    }

    // Get site settings
    let siteName = "M4UHDTV"
    if (useContabo) {
      const settings = await fetchSiteSettingsFromContabo()
      siteName = settings?.site_title || "M4UHDTV"
    } else {
      const { data: settings } = await supabase.from("site_settings").select("site_title").single()
      siteName = settings?.site_title || "M4UHDTV"
    }

    // Get user stats
    let postsCount = 0
    let followersCount = 0
    let favoritesCount = 0
    if (useContabo) {
      const posts = await fetchUserPostsFromContabo(profile.id, 1)
      postsCount = posts.length
      followersCount = await getFollowersCountFromContabo(profile.id)
      const favorites = await fetchUserFavoritesFromContabo(profile.id, 1)
      favoritesCount = favorites.length
    } else {
      const { count: posts } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
      postsCount = posts || 0

      const { count: followers } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id)
      followersCount = followers || 0

      const { count: favorites } = await supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
      favoritesCount = favorites || 0
    }

    const description = profile.about
      ? profile.about.substring(0, 150).trim() + (profile.about.length > 150 ? "..." : "")
      : `${username} ??? ${postsCount || 0} posts ??? ${followersCount || 0} followers ??? ${favoritesCount || 0} favorites on ${siteName}`

    const url = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.vercel.app"
    const profileUrl = `${url}/profile/${username}`
    const profileImage = profile.profile_picture_url || `${url}/placeholder.svg?height=400&width=400`

    return {
      title: `${username} - ${siteName}`,
      description: description,
      openGraph: {
        title: `${username}`,
        description: description,
        url: profileUrl,
        siteName: siteName,
        type: "profile",
        images: [
          {
            url: profileImage,
            width: 1200,
            height: 630,
            alt: `${username}'s profile`,
          },
        ],
        locale: "en_US",
      },
      twitter: {
        card: "summary",
        title: `${username}`,
        description: description,
        images: [profileImage],
      },
      alternates: {
        canonical: profileUrl,
      },
    }
  } catch (error) {
    console.error("Error generating metadata for profile:", error)
    return {
      title: `${username}'s Profile`,
      description: `View ${username}'s public profile and favorite movies`,
    }
  }
}
