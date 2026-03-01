import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { preferUseObservable } from '../../src/rules/prefer-use-observable';
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

ruleTester.run('prefer-use-observable', preferUseObservable, {
  valid: [
    // 1. Using useObservable already — no warning
    {
      code: `
        import { useObservable } from '@legendapp/state/react';
        const count$ = useObservable(0);
      `,
    },
    // 2. useState from a non-tracked source — no warning
    {
      code: `
        import { useState } from 'preact/hooks';
        const [count, setCount] = useState(0);
      `,
    },
    // 3. No import of useState — no warning
    {
      code: `const count = someOtherHook(0);`,
    },
    // 4. allowPatterns: isOpen matches — no warning
    {
      code: `
        import { useState } from 'react';
        const [isOpen, setIsOpen] = useState(false);
      `,
      options: [{ allowPatterns: ['^isOpen$'] }],
    },
    // 5. allowPatterns: modal prefix matches — no warning
    {
      code: `
        import { useState } from 'react';
        const [modalVisible, setModalVisible] = useState(false);
      `,
      options: [{ allowPatterns: ['^modal'] }],
    },
    // 6. Import without calling — no warning
    {
      code: `import { useState } from 'react';`,
    },
    // 7. useState from custom source excluded via importSources
    {
      code: `
        import { useState } from 'react';
        const [count, setCount] = useState(0);
      `,
      options: [{ importSources: ['preact/hooks'] }],
    },
  ],

  invalid: [
    // 1. Basic useState usage → warning
    {
      code: `
        import { useState } from 'react';
        const [count, setCount] = useState(0);
      `,
      errors: [{ messageId: 'preferUseObservable' }],
    },
    // 2. useState with object initial state
    {
      code: `
        import { useState } from 'react';
        const [user, setUser] = useState({ name: '' });
      `,
      errors: [{ messageId: 'preferUseObservable' }],
    },
    // 3. Aliased useState import
    {
      code: `
        import { useState as useLocalState } from 'react';
        const [count, setCount] = useLocalState(0);
      `,
      errors: [{ messageId: 'preferUseObservable' }],
    },
    // 4. Multiple useState calls → multiple errors
    {
      code: `
        import { useState } from 'react';
        const [count, setCount] = useState(0);
        const [name, setName] = useState('');
      `,
      errors: [
        { messageId: 'preferUseObservable' },
        { messageId: 'preferUseObservable' },
      ],
    },
    // 5. allowPatterns but this variable doesn't match
    {
      code: `
        import { useState } from 'react';
        const [count, setCount] = useState(0);
      `,
      options: [{ allowPatterns: ['^isOpen$'] }],
      errors: [{ messageId: 'preferUseObservable' }],
    },
    // 6. Custom importSources — warns when source matches
    {
      code: `
        import { useState } from 'preact/hooks';
        const [count, setCount] = useState(0);
      `,
      options: [{ importSources: ['preact/hooks'] }],
      errors: [{ messageId: 'preferUseObservable' }],
    },
  ],
});
