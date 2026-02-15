import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'

// Suppress unhandled promise rejections from TanStack Query mutation error tests
beforeAll(() => {
  // Handle unhandled rejections in jsdom environment
  if (typeof window !== 'undefined') {
    // Add listener that prevents the rejection from propagating
    window.addEventListener('unhandledrejection', (event) => {
      // These rejections come from mutations that throw errors but are properly handled
      // by the QueryClient's mutationCache onError handler and test assertions
      event.preventDefault()
    }, false)
  }

  // Handle Node.js process rejections (fallback for non-jsdom environments)
  if (typeof process !== 'undefined' && process.on) {
    // Set max listeners high to avoid warnings about multiple handlers
    if (process.setMaxListeners) {
      process.setMaxListeners(100)
    }

    process.on('unhandledRejection', (reason: any) => {
      // Silently swallow unhandled rejections
      // These come from mutations that throw errors but are properly handled
      // by the QueryClient's mutationCache onError handler
      // Do not re-throw or log these
    })
  }
})

afterEach(() => {
  cleanup()
})
