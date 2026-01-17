"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  const handleSignOut = async () => {
    await signOut({
      callbackUrl: "/",
      redirect: true,
    })
  }

  return (
    <button onClick={handleSignOut} className="flex w-full items-center">
      <LogOut className="mr-2 h-4 w-4" />
      <span>Log out</span>
    </button>
  )
}

