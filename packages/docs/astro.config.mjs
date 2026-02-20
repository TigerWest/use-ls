// @ts-check
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'

// https://astro.build/config
export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@demos/utils': fileURLToPath(new URL('../utils/src', import.meta.url)),
        '@demos/integrations': fileURLToPath(new URL('../integrations/src', import.meta.url)),
      },
    },
  },
  integrations: [
    starlight({
      title: 'legendapp-state-utils',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/your-org/legendapp-state-utils' }],
      components: {
        PageTitle: './src/components/overrides/PageTitle.astro',
      },
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Example Guide', slug: 'guides/example' },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
        {
          label: 'Utils',
          autogenerate: { directory: 'utils' },
        },
        {
          label: 'Integrations',
          autogenerate: { directory: 'integrations' },
        },
      ],
    }),
    mdx(),
    react(),
  ],
})
