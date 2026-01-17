-- M4UHDTV Database Schema for Supabase (PostgreSQL)
-- Run this script in Supabase SQL Editor

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS movie_actors CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS actors CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS movies CASCADE;

-- Movies table (stores both movies and TV series)
CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    imdb_id VARCHAR(20) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    -- Renamed poster to poster_url and backdrop to backdrop_url to match API
    poster_url VARCHAR(500),
    backdrop_url VARCHAR(500),
    trailer_url VARCHAR(500),
    release_date DATE,
    -- Added duration column (API uses this instead of runtime)
    duration VARCHAR(50),
    runtime INTEGER,
    rating DECIMAL(3,1),
    director VARCHAR(255),
    country VARCHAR(100),
    production VARCHAR(255),
    quality VARCHAR(20),
    type VARCHAR(20) DEFAULT 'movie',
    status VARCHAR(20) DEFAULT 'active',
    views INTEGER DEFAULT 0,
    total_seasons INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Genres table
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Movie-Genre relationship (many-to-many)
CREATE TABLE movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

-- Actors table
CREATE TABLE actors (
    id SERIAL PRIMARY KEY,
    imdb_id VARCHAR(20) UNIQUE,
    name VARCHAR(255) NOT NULL,
    photo VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Movie-Actor relationship (many-to-many)
CREATE TABLE movie_actors (
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    character_name VARCHAR(255),
    PRIMARY KEY (movie_id, actor_id)
);

-- Seasons table (for TV series)
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    title VARCHAR(255),
    episode_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (movie_id, season_number)
);

-- Episodes table (for TV series)
CREATE TABLE episodes (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT,
    runtime INTEGER,
    release_date DATE,
    imdb_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (season_id, episode_number)
);

-- Comments table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    user_name VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reactions table (emoji reactions)
CREATE TABLE reactions (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    user_ip VARCHAR(45) NOT NULL,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (movie_id, user_ip)
);

-- Create indexes for better performance
CREATE INDEX idx_movies_type ON movies(type);
CREATE INDEX idx_movies_rating ON movies(rating);
CREATE INDEX idx_movies_created ON movies(created_at);
CREATE INDEX idx_seasons_movie ON seasons(movie_id);
CREATE INDEX idx_episodes_season ON episodes(season_id);
CREATE INDEX idx_comments_movie ON comments(movie_id);
CREATE INDEX idx_comments_created ON comments(created_at);
CREATE INDEX idx_reactions_movie ON reactions(movie_id);

-- Insert default genres
INSERT INTO genres (name, slug) VALUES
('Action', 'action'),
('Adventure', 'adventure'),
('Animation', 'animation'),
('Comedy', 'comedy'),
('Crime', 'crime'),
('Documentary', 'documentary'),
('Drama', 'drama'),
('Family', 'family'),
('Fantasy', 'fantasy'),
('History', 'history'),
('Horror', 'horror'),
('Music', 'music'),
('Mystery', 'mystery'),
('Romance', 'romance'),
('Science Fiction', 'science-fiction'),
('TV Movie', 'tv-movie'),
('Thriller', 'thriller'),
('War', 'war'),
('Western', 'western');
