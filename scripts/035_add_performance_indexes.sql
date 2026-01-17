-- Adding database indexes for performance optimization with 5k+ daily visitors
-- These indexes will significantly speed up common queries without breaking any functionality

-- Movies table indexes for common queries
CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type);
CREATE INDEX IF NOT EXISTS idx_movies_views ON movies(views DESC);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);

-- Junction table indexes for joins
CREATE INDEX IF NOT EXISTS idx_movie_genres_movie_id ON movie_genres(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_id ON movie_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_id ON movie_actors(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_actors_actor_id ON movie_actors(actor_id);
CREATE INDEX IF NOT EXISTS idx_movie_tags_movie_id ON movie_tags(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_tags_tag_id ON movie_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_movie_id ON movie_countries(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_country_id ON movie_countries(country_id);

-- Seasons and episodes indexes
CREATE INDEX IF NOT EXISTS idx_seasons_movie_id ON seasons(movie_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);

-- Comments and reactions indexes
CREATE INDEX IF NOT EXISTS idx_comments_movie_id ON comments(movie_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_movie_id ON reactions(movie_id);

-- Community/TalkFlix indexes
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_post_id ON post_hashtags(post_id);

-- Download links indexes
CREATE INDEX IF NOT EXISTS idx_download_links_movie_id ON download_links(movie_id);
CREATE INDEX IF NOT EXISTS idx_download_links_episode_id ON download_links(episode_id);

-- Blog indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_movies_type_views ON movies(type, views DESC);
CREATE INDEX IF NOT EXISTS idx_movies_type_release_date ON movies(type, release_date DESC);
CREATE INDEX IF NOT EXISTS idx_movies_type_created_at ON movies(type, created_at DESC);

-- Text search optimization (if using full-text search)
CREATE INDEX IF NOT EXISTS idx_movies_title_gin ON movies USING gin(to_tsvector('english', title));
