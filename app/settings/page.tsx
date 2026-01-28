import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UpdateProfileForm } from "@/components/update-profile-form"
import { ChangePasswordForm } from "@/components/change-password-form"
import { NotificationPreferencesForm } from "@/components/notification-preferences-form"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"
import { getContaboPool } from "@/lib/database/contabo-pool"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  try {
    const session = await getAuthSession()
    
    const sessionUserId = (session?.user as { id?: string | null; email?: string | null; name?: string | null } | null)?.id || null
    const sessionUserEmail = (session?.user as { email?: string | null } | null)?.email || null
    const sessionUserName = (session?.user as { name?: string | null } | null)?.name || null
    console.log("[Settings Page] Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasUserId: !!sessionUserId,
      userId: sessionUserId,
      userEmail: sessionUserEmail,
      userName: sessionUserName
    })

    // If no session, redirect to login with callback URL
    if (!sessionUserId) {
      console.log("[Settings Page] No session found, redirecting to login")
      redirect("/auth/login?callbackUrl=/settings")
    }

    // Fetch profile from Contabo
    const pool = getContaboPool()
    let result = await pool.query("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [sessionUserId])
    let profile = result.rows[0]

    // If profile doesn't exist, create a basic one
    if (!profile) {
      const defaultUsername = sessionUserEmail?.split("@")[0] || `user_${sessionUserId.substring(0, 8)}`
      
      try {
        await pool.query(
          `INSERT INTO profiles (id, username, email, role, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
          [sessionUserId, defaultUsername, sessionUserEmail || null, 'user']
        )
        // Fetch the newly created profile
        result = await pool.query("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [sessionUserId])
        profile = result.rows[0]
      } catch (createError) {
        console.error("[Settings] Error creating profile:", createError)
        // If creation fails, redirect to complete profile page
        redirect("/auth/complete-profile")
      }
    }

    if (!profile) {
      redirect("/auth/complete-profile")
    }

  return (
    <div className="container max-w-4xl py-8 px-4">
      <h1 className="mb-6 text-3xl font-bold">Account Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your username, bio, and profile picture</CardDescription>
          </CardHeader>
          <CardContent>
            <UpdateProfileForm profile={profile} userId={sessionUserId} />
          </CardContent>
        </Card>

        <Card id="change-password">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
        {/* </CHANGE> */}

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>Manage your email notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationPreferencesForm />
          </CardContent>
        </Card>
      </div>
    </div>
    )
  } catch (error) {
    console.error("[Settings Page] Error:", error)
    redirect("/auth/login")
  }
}
