import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createSubjectSchema } from '@bluelearn/schemas'
import { requireUser } from '../middleware/auth.middleware'
import { slugify } from '../lib/slug'
import type { HonoEnv } from '../types'

export const subjectsRouter = new Hono<HonoEnv>()
  // List all subjects
  .get('/', async (c) => {
    const supabase = c.get('supabase')
    const { data, error } = await supabase
      .from('subjects')
      .select('id, slug, name, creator_id, created_at')
      .order('name')

    if (error) return c.json({ error: error.message }, 500)
    return c.json({ subjects: data ?? [] })
  })

  // Create a subject
  .post('/', requireUser, zValidator('json', createSubjectSchema), async (c) => {
    const supabase = c.get('supabase')
    const user = c.get('user')
    const { name, slug: inputSlug } = c.req.valid('json')

    const slug = slugify(inputSlug || name)
    if (!slug) {
      return c.json({ error: 'Subject name or slug must contain at least one letter or number' }, 400)
    }

    const { data: subject, error } = await supabase
      .from('subjects')
      .insert({
        name,
        slug,
        creator_id: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A subject with this slug already exists' }, 409)
      }
      return c.json({ error: error.message }, 500)
    }

    return c.json({ subject }, 201)
  })

  // Subject metadata only (the tagged list is a separate call)
  .get('/:slug', async (c) => {
    const supabase = c.get('supabase')
    const slug = c.req.param('slug').toLowerCase()

    const { data: subject, error } = await supabase
      .from('subjects')
      .select('id, slug, name, creator_id, created_at')
      .eq('slug', slug)
      .maybeSingle()

    if (error) return c.json({ error: error.message }, 500)
    if (!subject) return c.json({ error: 'Subject not found' }, 404)

    return c.json({ subject })
  })

  // Alphabetical list of topics carrying this subject tag
  .get('/:slug/guides', async (c) => {
    const supabase = c.get('supabase')
    const slug = c.req.param('slug').toLowerCase()

    // Fetch the subject to get its ID
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (subjectError) return c.json({ error: subjectError.message }, 500)
    if (!subject) return c.json({ error: 'Subject not found' }, 404)

    // Fetch the guide bases associated with this subject
    const { data, error } = await supabase
      .from('guide_bases')
      .select(`
        id,
        slug,
        title,
        knowledge_type,
        status,
        canonical:guides!guide_bases_canonical_guide_id_fkey(
          current:guide_revisions!guides_current_revision_id_fkey(
            summary
          )
        ),
        guide_subjects!inner(
          subject_id
        )
      `)
      .eq('status', 'published')
      .eq('guide_subjects.subject_id', subject.id)
      .order('title')

    if (error) return c.json({ error: error.message }, 500)

    const topics = (data ?? []).map(({ canonical, guide_subjects, ...base }) => ({
      ...base,
      summary: canonical?.current?.summary ?? null,
    }))

    return c.json({ topics })
  })