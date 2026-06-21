import { z } from 'zod'

// For creating a subject, shared by the API (request validation) and the frontend (form validation + inferred type).
export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9-]+$/, {
      message: 'Slug may only contain letters, numbers, and hyphens.',
    })
    .optional(),
})

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>
