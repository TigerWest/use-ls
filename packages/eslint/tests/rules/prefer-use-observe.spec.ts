import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { preferUseObserve } from '../../src/rules/prefer-use-observe';
import * as parser from '@typescript-eslint/parser';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
  },
});

ruleTester.run('prefer-use-observe', preferUseObserve, {
  valid: [
    // 1. useObserve already — no warning
    {
      code: `
        import { useObserve } from '@legendapp/state/react';
        useObserve(() => { console.log(count$.get()); });
      `,
    },
    // 2. useEffect from non-tracked source (preact/hooks) — no warning
    {
      code: `
        import { useEffect } from 'preact/hooks';
        useEffect(() => { console.log(count$.get()); }, []);
      `,
    },
    // 3. No import of useEffect — no warning
    {
      code: `const count = count$.get();`,
    },
    // 4. Import without calling — no warning
    {
      code: `import { useEffect } from 'react';`,
    },
    // 5. useLayoutEffect with includeLayoutEffect: false (default) — no warning
    //    Legend-State has no useLayoutEffect equivalent, so this must remain allowed
    {
      code: `
        import { useLayoutEffect } from 'react';
        useLayoutEffect(() => { console.log(count$.get()); }, []);
      `,
    },
    // 6. Custom importSources excludes react — no warning
    {
      code: `
        import { useEffect } from 'react';
        useEffect(() => { console.log(count$.get()); }, []);
      `,
      options: [{ importSources: ['preact/hooks'] }],
    },
  ],

  invalid: [
    // 1. useEffect with observable in callback
    {
      code: `
        import { useEffect } from 'react';
        useEffect(() => { console.log(count$.get()); }, [count$.get()]);
      `,
      errors: [{ messageId: 'preferUseObserve' }],
    },
    // 2. useEffect with non-observable side effect — always warned
    {
      code: `
        import { useEffect } from 'react';
        useEffect(() => { document.title = title; }, [title]);
      `,
      errors: [{ messageId: 'preferUseObserve' }],
    },
    // 3. useEffect with fetch — always warned
    {
      code: `
        import { useEffect } from 'react';
        useEffect(() => { fetch('/api/data'); }, []);
      `,
      errors: [{ messageId: 'preferUseObserve' }],
    },
    // 4. Aliased useEffect import
    {
      code: `
        import { useEffect as useMount } from 'react';
        useMount(() => { console.log(items$.get()); }, []);
      `,
      errors: [{ messageId: 'preferUseObserve' }],
    },
    // 5. useLayoutEffect with includeLayoutEffect: true
    {
      code: `
        import { useLayoutEffect } from 'react';
        useLayoutEffect(() => { console.log(count$.get()); }, []);
      `,
      options: [{ includeLayoutEffect: true }],
      errors: [{ messageId: 'preferUseObserve' }],
    },
    // 6. Multiple useEffect calls — multiple errors
    {
      code: `
        import { useEffect } from 'react';
        useEffect(() => { console.log(a$.get()); }, []);
        useEffect(() => { console.log(b$.get()); }, []);
      `,
      errors: [
        { messageId: 'preferUseObserve' },
        { messageId: 'preferUseObserve' },
      ],
    },
    // 7. Custom importSources: preact/hooks — warns when matching
    {
      code: `
        import { useEffect } from 'preact/hooks';
        useEffect(() => { console.log(count$.get()); }, []);
      `,
      options: [{ importSources: ['preact/hooks'] }],
      errors: [{ messageId: 'preferUseObserve' }],
    },
  ],
});
