import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Calendar, Shield, MapPin, Heart, Bookmark } from "lucide-react"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await getAuthSession()

  if (!session?.user || !(session.user as any).id) {
    redirect("/auth/login")
  }

  const user = session.user as { id: string; email?: string | null; name?: string | null; image?: string | null }

  // Fetch profile from Contabo
  const pool = getContaboPool()
  let result = await pool.query("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [user.id])
  let profile = result.rows[0]

  // If profile doesn't exist, create a basic one
  if (!profile) {
    const defaultUsername = user.email?.split("@")[0] || `user_${user.id.substring(0, 8)}`

    try {
      await pool.query(
        `INSERT INTO profiles (id, username, email, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
        [user.id, defaultUsername, user.email || null, 'user']
      )
      // Fetch the newly created profile
      result = await pool.query("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [user.id])
      profile = result.rows[0]
    } catch (createError) {
      console.error("[Profile] Error creating profile:", createError)
      // If creation fails, redirect to complete profile page
      redirect("/auth/complete-profile")
    }
  }

  if (!profile) {
    redirect("/auth/complete-profile")
  }

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <div className="flex gap-2">
          <Link href={`/community/profile/${profile.username}`}>
            <Button variant="outline">View TalkFlix Profile</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline">Edit Profile</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {profile.profile_picture_url ? (
              <Image
                src={profile.profile_picture_url || "/placeholder.svg"}
                alt={profile.username}
                width={200}
                height={200}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-full bg-primary text-6xl font-bold text-primary-foreground">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold">{profile.username}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span className="capitalize">{profile.role}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email || profile.email || "No email"}</p>
              </div>
            </div>

            {profile.country && (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Country</p>
                  <p className="text-sm text-muted-foreground">{profile.country}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Account Role</p>
                <p className="text-sm text-muted-foreground capitalize">{profile.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Link href="/profile/my-watchlist">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <Bookmark className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>My Watchlist</CardTitle>
                <CardDescription>Movies and shows you want to watch</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/profile/my-favorites">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-full">
                <Heart className="h-6 w-6 text-red-500 fill-current" />
              </div>
              <div>
                <CardTitle>My Favorites</CardTitle>
                <CardDescription>Your favorite content</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Activity (v2)</CardTitle>
          <CardDescription>Your recent activity on the site</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity to display.</p>
        </CardContent>
      </Card>
    </div>
  )
}
