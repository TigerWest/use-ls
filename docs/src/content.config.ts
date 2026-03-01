import { defineCollection, z } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        category: z.string().optional(),
        package: z.enum(['integrations', 'core']).optional(),
        sourceFile: z.string().optional(),
        lastChanged: z.coerce.string().optional(),
        contributors: z.array(z.object({
          name: z.string(),
          email: z.string(),
        })).optional(),
      })
    })
  }),
}
