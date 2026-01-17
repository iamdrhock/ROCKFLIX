import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfileNotFound() {
  return (
    <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Profile Not Found</CardTitle>
          <CardDescription>The user profile you're looking for doesn't exist or has been removed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button className="w-full">Return Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
