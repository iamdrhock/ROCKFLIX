import { redirect } from "next/navigation"
import { NotificationsList } from "@/components/community/notifications-list"
import { getAuthSession } from "@/lib/auth/nextauth-helpers"

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>
      <NotificationsList />
    </div>
  )
}
