-- Add movie tagging to posts
CREATE TABLE IF NOT EXISTS public.post_movies (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  movie_id BIGINT NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, movie_id)
);

-- Enable RLS
ALTER TABLE public.post_movies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view post_movies"
  ON public.post_movies FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage post_movies"
  ON public.post_movies FOR ALL
  USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS post_movies_post_id_idx ON public.post_movies(post_id);
CREATE INDEX IF NOT EXISTS post_movies_movie_id_idx ON public.post_movies(movie_id);
