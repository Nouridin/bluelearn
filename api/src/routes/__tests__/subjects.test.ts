import { Hono } from 'hono'
import { describe, it, expect, vi } from 'vitest'
import { subjectsRouter } from '../subjects'

describe('Subjects API', () => {
  it('GET / lists all subjects', async () => {
    const mockSubjects = [
      { id: '1', slug: 'computer-science', name: 'Computer Science', creator_id: 'u1', created_at: '2026-06-21' }
    ]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSubjects, error: null })
        })
      })
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ subjects: mockSubjects })
    expect(mockSupabase.from).toHaveBeenCalledWith('subjects')
  })

  it('GET /:slug returns subject metadata', async () => {
    const mockSubject = { id: '1', slug: 'computer-science', name: 'Computer Science', creator_id: 'u1', created_at: '2026-06-21' }

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSubject, error: null })
          })
        })
      })
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/computer-science')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ subject: mockSubject })
  })

  it('GET /:slug/guides lists guides for subject', async () => {
    const mockSubject = { id: '1', slug: 'computer-science' }
    const mockGuides = [
      {
        id: 'g1',
        slug: 'intro-to-coding',
        title: 'Intro to Coding',
        knowledge_type: 'theory',
        status: 'published',
        canonical: { current: { summary: 'A guide' } }
      }
    ]

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === 'subjects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockSubject, error: null })
              })
            })
          } as any
        }
        if (table === 'guide_bases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockGuides, error: null })
                })
              })
            })
          } as any
        }
        return {} as any
      })
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/computer-science/guides')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({
      topics: [
        { id: 'g1', slug: 'intro-to-coding', title: 'Intro to Coding', knowledge_type: 'theory', status: 'published', summary: 'A guide' }
      ]
    })
  })

  it('POST / creates a subject', async () => {
    const mockSubject = { id: '1', slug: 'computer-science', name: 'Computer Science', creator_id: 'u1' }

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSubject, error: null })
          })
        })
      })
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Computer Science' })
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ subject: mockSubject })
  })

  it('POST / returns 401 when unauthenticated', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Computer Science' }),
    })

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('GET /:slug returns 404 when subject does not exist', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/does-not-exist')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json).toEqual({ error: 'Subject not found' })
  })

  it('POST / returns 409 when slug already exists', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            }),
          }),
        }),
      }),
    }

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('supabase', mockSupabase as any)
      await next()
    })
    app.route('/', subjectsRouter)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Computer Science' }),
    })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toEqual({ error: 'A subject with this slug already exists' })
  })
})
