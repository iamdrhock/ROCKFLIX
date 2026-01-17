-- RockFlix Database Schema for DigitalOcean PostgreSQL
-- This script creates all tables with their constraints and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create actors table
CREATE TABLE IF NOT EXISTS actors (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    name VARCHAR(255),
    photo_url TEXT
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    password_hash TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITHOUT TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITHOUT TIME ZONE
);

-- Create admin_sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- Create advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
    id BIGSERIAL PRIMARY KEY,
    position VARCHAR(50),
    content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500),
    slug VARCHAR(500) UNIQUE,
    body TEXT,
    featured_image_url TEXT,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create movies table
CREATE TABLE IF NOT EXISTS movies (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500),
    description TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    trailer_url TEXT,
    release_date VARCHAR(50),
    duration VARCHAR(50),
    rating NUMERIC(3, 1),
    quality VARCHAR(50),
    type VARCHAR(50),
    country VARCHAR(255),
    imdb_id VARCHAR(50),
    tmdb_id VARCHAR(50),
    total_seasons INTEGER,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    season_number INTEGER,
    title VARCHAR(500),
    episode_count INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER,
    title VARCHAR(500),
    release_date VARCHAR(50),
    imdb_id VARCHAR(50),
    tmdb_id VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create movie_genres junction table
CREATE TABLE IF NOT EXISTS movie_genres (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    genre_id BIGINT REFERENCES genres(id) ON DELETE CASCADE,
    UNIQUE(movie_id, genre_id)
);

-- Create movie_countries junction table
CREATE TABLE IF NOT EXISTS movie_countries (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    country_id BIGINT REFERENCES countries(id) ON DELETE CASCADE,
    UNIQUE(movie_id, country_id)
);

-- Create movie_actors junction table
CREATE TABLE IF NOT EXISTS movie_actors (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES actors(id) ON DELETE CASCADE,
    character_name VARCHAR(500)
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    profile_picture_url TEXT,
    role TEXT DEFAULT 'user',
    about TEXT,
    country TEXT,
    is_banned BOOLEAN DEFAULT false,
    banned_reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

-- Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user_name VARCHAR(255),
    comment_text TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50),
    user_ip VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255),
    endpoint VARCHAR(255),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
    id BIGSERIAL PRIMARY KEY,
    site_title VARCHAR(255),
    site_description TEXT,
    site_logo_url TEXT,
    site_favicon_url TEXT,
    footer_text TEXT,
    header_custom_code TEXT,
    footer_custom_code TEXT,
    watch_page_custom_html TEXT,
    meta_home_title TEXT,
    meta_movies_list_title TEXT,
    meta_series_list_title TEXT,
    meta_movie_detail_title TEXT,
    meta_series_detail_title TEXT,
    meta_blog_list_title TEXT,
    meta_blog_post_title TEXT,
    meta_page_title TEXT,
    header_menu JSONB,
    footer_links JSONB,
    social_links JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create custom_pages table
CREATE TABLE IF NOT EXISTS custom_pages (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500),
    slug VARCHAR(500) UNIQUE,
    content TEXT,
    featured_image_url TEXT,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_users_backup table
CREATE TABLE IF NOT EXISTS admin_users_backup (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255),
    password VARCHAR(255),
    password_hash TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    last_login TIMESTAMP WITHOUT TIME ZONE,
    failed_login_attempts INTEGER,
    locked_until TIMESTAMP WITHOUT TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type);
CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_views ON movies(views DESC);
CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_seasons_movie_id ON seasons(movie_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_movie_genres_movie_id ON movie_genres(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_id ON movie_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_movie_countries_movie_id ON movie_countries(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_id ON movie_actors(movie_id);
CREATE INDEX IF NOT EXISTS idx_comments_movie_id ON comments(movie_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON custom_pages(slug);

-- Insert default site settings if not exists
INSERT INTO site_settings (site_title, site_description)
SELECT 'RockFlix', 'Your favorite movies and TV shows'
WHERE NOT EXISTS (SELECT 1 FROM site_settings LIMIT 1);
