import Link from "next/link"
import type { Tag } from "@/lib/api"
import { TagIcon } from "lucide-react"

interface MovieTagsProps {
  tags: Tag[]
  className?: string
}

export function MovieTags({ tags, className = "" }: MovieTagsProps) {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <TagIcon className="h-4 w-4" />
        Tags
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/tag/${tag.slug}`}
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 transition-colors"
          >
            {tag.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
