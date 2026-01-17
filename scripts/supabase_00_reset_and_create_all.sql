-- Drop all existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS movie_actors CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS actors CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create movies table (main content table)
CREATE TABLE movies (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  release_date VARCHAR(50),
  rating DECIMAL(3,1),
  duration VARCHAR(50),
  poster_url TEXT,
  backdrop_url TEXT,
  trailer_url TEXT,
  quality VARCHAR(20) DEFAULT 'HD',
  type VARCHAR(20) NOT NULL CHECK (type IN ('movie', 'series')),
  imdb_id VARCHAR(20) UNIQUE,
  total_seasons INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create genres table
CREATE TABLE genres (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create actors table
CREATE TABLE actors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create movie_genres junction table
CREATE TABLE movie_genres (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
  genre_id BIGINT REFERENCES genres(id) ON DELETE CASCADE,
  UNIQUE(movie_id, genre_id)
);

-- Added character_name column to store which character the actor plays
-- Create movie_actors junction table
CREATE TABLE movie_actors (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES actors(id) ON DELETE CASCADE,
  character_name VARCHAR(255),
  UNIQUE(movie_id, actor_id)
);

-- Create seasons table (for TV series)
CREATE TABLE seasons (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  title VARCHAR(255),
  episode_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(movie_id, season_number)
);

-- Create episodes table
CREATE TABLE episodes (
  id BIGSERIAL PRIMARY KEY,
  season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  imdb_id VARCHAR(20),
  release_date VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(season_id, episode_number)
);

-- Create comments table
CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create admin_users table
CREATE TABLE admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin user (username: admin, password: admin123)
INSERT INTO admin_users (username, password) 
VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX idx_movies_type ON movies(type);
CREATE INDEX idx_movies_imdb_id ON movies(imdb_id);
CREATE INDEX idx_movies_created_at ON movies(created_at DESC);
CREATE INDEX idx_movie_genres_movie_id ON movie_genres(movie_id);
CREATE INDEX idx_movie_genres_genre_id ON movie_genres(genre_id);
CREATE INDEX idx_movie_actors_movie_id ON movie_actors(movie_id);
CREATE INDEX idx_movie_actors_actor_id ON movie_actors(actor_id);
CREATE INDEX idx_seasons_movie_id ON seasons(movie_id);
CREATE INDEX idx_episodes_season_id ON episodes(season_id);
CREATE INDEX idx_comments_movie_id ON comments(movie_id);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access
CREATE POLICY "Allow public read access" ON movies FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON genres FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON actors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON movie_genres FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON movie_actors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON seasons FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON episodes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON comments FOR SELECT USING (true);

-- Create policies to allow service role full access (for API routes)
CREATE POLICY "Allow service role full access" ON movies FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON genres FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON actors FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON movie_genres FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON movie_actors FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON seasons FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON episodes FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON comments FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON admin_users FOR ALL USING (true);
