/**
 * Contabo-backed movie queries for the public site
 * Uses only Contabo PostgreSQL via queryContabo.
 */

import { queryContabo } from "./contabo-pool"

export interface ContaboMovie {
  id: number
  title: string
  description?: string
  poster_url?: string
  backdrop_url?: string
  release_date?: string
  rating?: number
  quality?: string
  type: "movie" | "series"
  created_at?: string
  genres?: string
}

export interface MoviesFilters {
  genre?: string | null
  country?: string | null
  year?: number | null
}

export async function fetchMoviesFromContabo(
  type: "movie" | "series",
  limit: number,
  page: number,
  filters: MoviesFilters,
): Promise<{ movies: ContaboMovie[]; total: number; totalPages: number }> {
  const offset = (page - 1) * limit

  const params: any[] = [type]
  let paramIndex = 2

  let where = `m.type = $1`

  if (filters.genre) {
    where += ` AND EXISTS (
      SELECT 1
      FROM movie_genres mg
      JOIN genres g ON mg.genre_id = g.id
      WHERE mg.movie_id = m.id AND g.name ILIKE $${paramIndex}
    )`
    params.push(`%${filters.genre}%`)
    paramIndex++
  }

  if (filters.country) {
    where += ` AND EXISTS (
      SELECT 1
      FROM movie_countries mc
      JOIN countries c ON mc.country_id = c.id
      WHERE mc.movie_id = m.id AND c.name = $${paramIndex}
    )`
    params.push(filters.country)
    paramIndex++
  }

  if (filters.year) {
    where += ` AND m.release_date IS NOT NULL
               AND m.release_date <> ''
               AND substring(m.release_date from 1 for 4) = $${paramIndex}`
    params.push(String(filters.year))
    paramIndex++
  }

  const sql = `
    SELECT
      m.*,
      COALESCE(string_agg(DISTINCT g.name, ', '), '') AS genres
    FROM movies m
    LEFT JOIN movie_genres mg ON m.id = mg.movie_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE ${where}
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const countSql = `
    SELECT COUNT(DISTINCT m.id) AS total
    FROM movies m
    WHERE ${where}
  `

  const [moviesResult, countResult] = await Promise.all([
    queryContabo<ContaboMovie & { genres: string }>(sql, params),
    queryContabo<{ total: string }>(countSql, params),
  ])

  const total = parseInt(countResult.rows[0]?.total || "0", 10)
  const totalPages = Math.ceil(total / limit)

  return {
    movies: moviesResult.rows,
    total,
    totalPages,
  }
}

export async function fetchGenresFromContabo(): Promise<string[]> {
  const sql = `SELECT DISTINCT name FROM genres ORDER BY name ASC`
  const result = await queryContabo<{ name: string }>(sql)
  return result.rows.map((r) => r.name)
}

export async function fetchCountriesFromContabo(type: "movie" | "series"): Promise<string[]> {
  const sql = `
    SELECT DISTINCT c.name
    FROM countries c
    JOIN movie_countries mc ON c.id = mc.country_id
    JOIN movies m ON mc.movie_id = m.id
    WHERE m.type = $1
    ORDER BY c.name ASC
  `
  const result = await queryContabo<{ name: string }>(sql, [type])
  return result.rows.map((r) => r.name)
}

export async function fetchYearsFromContabo(type: "movie" | "series"): Promise<number[]> {
  const sql = `
    SELECT DISTINCT substring(m.release_date from 1 for 4)::int AS year
    FROM movies m
    WHERE m.type = $1
      AND m.release_date IS NOT NULL
      AND m.release_date <> ''
      AND m.release_date ~ '^[0-9]{4}'
    ORDER BY year DESC
  `
  const result = await queryContabo<{ year: number }>(sql, [type])
  return result.rows.map((r) => r.year)
}
