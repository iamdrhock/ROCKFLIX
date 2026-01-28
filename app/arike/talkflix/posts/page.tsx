import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import { ClientHeader } from "@/components/client-header"

const deletePost: (formData: FormData) => Promise<void> = async (formData) => {
  "use server"

  const postId = formData.get("postId") as string
  if (!postId || !postId.trim()) {
    console.error("Please enter a post ID")
    return
  }

  const supabase = await createClient()

  // Delete related data first
  await supabase.from("post_reactions").delete().eq("post_id", Number(postId))
  await supabase.from("comments").delete().eq("post_id", Number(postId))
  await supabase.from("post_hashtags").delete().eq("post_id", Number(postId))
  await supabase.from("bookmarks").delete().eq("post_id", Number(postId))

  // Delete the post
  const { error } = await supabase.from("posts").delete().eq("id", Number(postId))

  if (error) {
    console.error("Error deleting post:", error)
    return
  }

  revalidatePath("/arike/talkflix/posts")
}

export default async function DeleteTalkFlixPostPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <ClientHeader />

      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/arike/dashboard">
            <Button variant="outline" className="gap-2 bg-transparent">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Delete TalkFlix Post</h1>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Delete Post by ID</CardTitle>
            <CardDescription>
              Enter the post ID to delete it. You can find the post ID at the end of the URL: community/posts/
              <strong>123</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deletePost} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="postId">Post ID</Label>
                <Input
                  id="postId"
                  name="postId"
                  type="number"
                  placeholder="Enter post ID (e.g., 123)"
                  className="text-lg"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Example: If the URL is <code className="bg-muted px-1 py-0.5 rounded">community/posts/42</code>, enter{" "}
                  <strong>42</strong>
                </p>
              </div>

              <Button type="submit" variant="destructive" className="gap-2" size="lg">
                <Trash2 className="h-4 w-4" />
                Delete Post Permanently
              </Button>
            </form>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">What gets deleted:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• The post content and media</li>
                <li>• All reactions (likes) on the post</li>
                <li>• All comments on the post</li>
                <li>• All hashtags associated with the post</li>
                <li>• All bookmarks of the post</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
