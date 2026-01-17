// Utility functions for hashtag extraction and processing

export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const matches = text.match(hashtagRegex)

  if (!matches) return []

  // Remove # and convert to lowercase, remove duplicates
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))]
}

export function linkifyHashtags(text: string): string {
  return text.replace(
    /#(\w+)/g,
    '<a href="/community?hashtag=$1" class="text-primary hover:underline font-semibold">#$1</a>',
  )
}
