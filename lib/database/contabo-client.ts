/**
 * Contabo PostgreSQL Database Client
 * 
 * Provides a Supabase-like interface for Contabo PostgreSQL
 * This allows us to use Contabo for data while keeping Supabase for auth
 */

import { queryContabo } from './contabo-pool'

export interface ContaboQueryBuilder {
  select(columns: string): ContaboQueryBuilder
  from(table: string): ContaboQueryBuilder
  eq(column: string, value: any): ContaboQueryBuilder
  ilike(column: string, pattern: string): ContaboQueryBuilder
  order(column: string, options?: { ascending: boolean }): ContaboQueryBuilder
  limit(count: number): ContaboQueryBuilder
  range(from: number, to: number): ContaboQueryBuilder
  single(): Promise<{ data: any; error: any }>
  then(resolve: (value: { data: any[] | null; error: any; count?: number }) => void): Promise<{ data: any[] | null; error: any; count?: number }>
}

class ContaboClient {
  from(table: string): ContaboQueryBuilder {
    return new ContaboQueryBuilderImpl(table)
  }
}

class ContaboQueryBuilderImpl implements ContaboQueryBuilder {
  private table: string
  private columns: string = '*'
  private whereConditions: Array<{ column: string; operator: string; value: any }> = []
  private orderBy?: { column: string; ascending: boolean }
  private limitCount?: number
  private rangeFrom?: number
  private rangeTo?: number
  private singleMode = false

  constructor(table: string) {
    this.table = table
  }

  select(columns: string): ContaboQueryBuilder {
    this.columns = columns
    return this
  }

  from(table: string): ContaboQueryBuilder {
    this.table = table
    return this
  }

  eq(column: string, value: any): ContaboQueryBuilder {
    this.whereConditions.push({ column, operator: '=', value })
    return this
  }

  ilike(column: string, pattern: string): ContaboQueryBuilder {
    this.whereConditions.push({ column, operator: 'ILIKE', value: pattern })
    return this
  }

  order(column: string, options?: { ascending: boolean }): ContaboQueryBuilder {
    this.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  limit(count: number): ContaboQueryBuilder {
    this.limitCount = count
    return this
  }

  range(from: number, to: number): ContaboQueryBuilder {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  async single(): Promise<{ data: any; error: any }> {
    this.singleMode = true
    this.limitCount = 1
    const result = await this.execute()
    return {
      data: result.data?.[0] || null,
      error: result.error,
    }
  }

  then(resolve: (value: { data: any[] | null; error: any; count?: number }) => void): Promise<{ data: any[] | null; error: any; count?: number }> {
    return this.execute().then(resolve)
  }

  private async execute(): Promise<{ data: any[] | null; error: any; count?: number }> {
    try {
      // Build SQL query
      let sql = `SELECT ${this.columns} FROM ${this.table}`

      // Add WHERE conditions
      const params: any[] = []
      if (this.whereConditions.length > 0) {
        const whereClauses = this.whereConditions.map((cond, idx) => {
          params.push(cond.value)
          return `${cond.column} ${cond.operator} $${idx + 1}`
        })
        sql += ` WHERE ${whereClauses.join(' AND ')}`
      }

      // Add ORDER BY
      if (this.orderBy) {
        sql += ` ORDER BY ${this.orderBy.column} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`
      }

      // Add LIMIT
      if (this.limitCount) {
        sql += ` LIMIT ${this.limitCount}`
      }

      // Add OFFSET (for range)
      if (this.rangeFrom !== undefined) {
        sql += ` OFFSET ${this.rangeFrom}`
      }

      const result = await queryContabo<any>(sql, params)
      
      return {
        data: result.rows,
        error: null,
        count: result.rowCount,
      }
    } catch (error: any) {
      console.error(`[Contabo] Query error on ${this.table}:`, error)
      return {
        data: null,
        error: { message: error.message, code: error.code },
      }
    }
  }
}

export function createContaboClient() {
  return new ContaboClient()
}

