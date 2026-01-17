-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create movie_tags junction table
CREATE TABLE IF NOT EXISTS public.movie_tags (
  movie_id BIGINT NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, tag_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS tags_name_idx ON public.tags(name);
CREATE INDEX IF NOT EXISTS tags_slug_idx ON public.tags(slug);
CREATE INDEX IF NOT EXISTS movie_tags_movie_id_idx ON public.movie_tags(movie_id);
CREATE INDEX IF NOT EXISTS movie_tags_tag_id_idx ON public.movie_tags(tag_id);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
CREATE POLICY "Anyone can view tags"
  ON public.tags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage tags"
  ON public.tags FOR ALL
  USING (true);

-- RLS Policies for movie_tags
CREATE POLICY "Anyone can view movie_tags"
  ON public.movie_tags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage movie_tags"
  ON public.movie_tags FOR ALL
  USING (true);
