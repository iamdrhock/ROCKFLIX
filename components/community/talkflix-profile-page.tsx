"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, MapPin, Loader2 } from "lucide-react"
import { PostCard } from "./post-card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserFavoriteMovies } from "./user-favorite-movies"

interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  profile_picture_url: string | null
  location: string | null
  created_at: string
}

interface Post {
  id: string
  user_id: string
  content: string
  created_at: string
  likes_count: number
  repost_count: number
  comment_count: number
  quoted_post_id: string | null
  is_repost: boolean
  youtube_url: string | null
  profiles: Profile | null
  tagged_movies?: any[]
  hashtags?: string[]
}

interface TalkFlixProfilePageProps {
  username: string
  initialProfile: Profile
  initialPosts: Post[]
  initialFollowersCount: number
  initialFollowingCount: number
  initialIsFollowing: boolean
  isOwnProfile: boolean
  currentUserId: string | null
}

export function TalkFlixProfilePage({
  username,
  initialProfile,
  initialPosts,
  initialFollowersCount,
  initialFollowingCount,
  initialIsFollowing,
  isOwnProfile,
  currentUserId,
}: TalkFlixProfilePageProps) {
  const router = useRouter()
  const [profile] = useState(initialProfile)
  const [posts, setPosts] = useState(initialPosts)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [followingCount] = useState(initialFollowingCount)
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("posts")

  const [visiblePostsCount, setVisiblePostsCount] = useState(10)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const handleFollow = async () => {
    if (!currentUserId) {
      router.push("/auth/login")
      return
    }

    setIsFollowLoading(true)
    try {
      const response = await fetch(`/api/community/follow/${profile.id}`, {
        method: isFollowing ? "DELETE" : "POST",
      })

      if (response.ok) {
        setIsFollowing(!isFollowing)
        setFollowersCount((prev) => (isFollowing ? prev - 1 : prev + 1))
      }
    } catch (error) {
      console.error("Error following/unfollowing:", error)
    } finally {
      setIsFollowLoading(false)
    }
  }

  const handlePostUpdate = () => {
    // Refresh posts after update
    fetch(`/api/community/posts?user=${username}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.posts) {
          setPosts(data.posts)
        }
      })
      .catch((err) => console.error("Error refreshing posts:", err))
  }

  const handleShowMore = () => {
    setIsLoadingMore(true)
    // Simulate loading delay for better UX
    setTimeout(() => {
      setVisiblePostsCount((prev) => prev + 10)
      setIsLoadingMore(false)
    }, 300)
  }

  const visiblePosts = posts.slice(0, visiblePostsCount)
  const hasMorePosts = posts.length > visiblePostsCount

  return (
    <div className="container max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="border-b border-gray-800">
        {/* Cover area */}
        <div className="h-48 bg-gradient-to-r from-red-900 via-gray-900 to-black" />

        <div className="px-4 pb-4">
          <div className="flex items-start justify-between -mt-16 mb-4">
            <Avatar className="h-32 w-32 border-4 border-black">
              <AvatarImage src={profile.profile_picture_url || undefined} />
              <AvatarFallback className="text-2xl bg-red-600 text-white">
                {profile.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            {!isOwnProfile && currentUserId && (
              <Button
                onClick={handleFollow}
                disabled={isFollowLoading}
                variant={isFollowing ? "outline" : "default"}
                className={
                  isFollowing
                    ? "text-white border-gray-600 hover:bg-red-900 hover:border-red-500 hover:text-red-500"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}

            {isOwnProfile && (
              <Button variant="outline" className="border-gray-600 bg-transparent" asChild>
                <Link href="/settings">Edit Profile</Link>
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{profile.display_name || profile.username}</h1>
              <p className="text-gray-400">@{profile.username}</p>
            </div>

            {profile.bio && <p className="text-white leading-relaxed">{profile.bio}</p>}

            <div className="flex items-center gap-4 text-sm text-gray-400">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="hover:underline cursor-pointer">
                <span className="font-bold text-white">{followingCount || 0}</span>{" "}
                <span className="text-gray-400">Following</span>
              </div>
              <div className="hover:underline cursor-pointer">
                <span className="font-bold text-white">{followersCount || 0}</span>{" "}
                <span className="text-gray-400">Followers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-black border-b border-gray-800 rounded-none h-auto p-0 justify-start">
          <TabsTrigger
            value="posts"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-red-600 data-[state=active]:bg-transparent py-4 text-gray-400 data-[state=active]:text-white"
          >
            Posts
          </TabsTrigger>
          <TabsTrigger
            value="replies"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-red-600 data-[state=active]:bg-transparent py-4 text-gray-400 data-[state=active]:text-white"
          >
            Replies
          </TabsTrigger>
          <TabsTrigger
            value="likes"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-red-600 data-[state=active]:bg-transparent py-4 text-gray-400 data-[state=active]:text-white"
          >
            Likes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="divide-y divide-gray-800">
            {posts && posts.length > 0 ? (
              <>
                {visiblePosts.map((post) => (
                  <div key={post.id} className="border-b border-gray-800">
                    <PostCard post={post} onUpdate={handlePostUpdate} />
                  </div>
                ))}

                {hasMorePosts && (
                  <div className="py-6 flex justify-center">
                    <Button
                      onClick={handleShowMore}
                      disabled={isLoadingMore}
                      variant="outline"
                      className="border-red-600 text-red-500 hover:bg-red-900/20 bg-transparent"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        `Show More (${posts.length - visiblePostsCount} remaining)`
                      )}
                    </Button>
                  </div>
                )}

                <div className="lg:hidden mt-8">
                  <UserFavoriteMovies userId={profile.id} username={username} />
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">@{username} hasn't posted yet</p>
                {isOwnProfile && (
                  <p className="text-gray-500 text-sm mt-2">Share your thoughts about movies and series!</p>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No replies yet</p>
            <p className="text-gray-500 text-sm mt-2">Replies to other posts will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="likes" className="mt-0">
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No liked posts yet</p>
            <p className="text-gray-500 text-sm mt-2">Posts @{username} likes will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
