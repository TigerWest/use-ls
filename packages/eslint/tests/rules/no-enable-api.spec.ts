import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noEnableApi } from '../../src/rules/no-enable-api';
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

ruleTester.run('no-enable-api', noEnableApi, {
  valid: [
    // 1. Using explicit .get() / .set() — no enable* import
    {
      code: `
        import { observable } from '@legendapp/state';
        const count$ = observable(0);
        count$.set(1);
        const val = count$.get();
      `,
    },

    // 2. Import without calling — not flagged
    {
      code: `import { enable$GetSet } from '@legendapp/state/config/enable$GetSet';`,
    },

    // 3. enable$GetSet in allowList — should not be reported
    {
      code: `
        import { enable$GetSet } from '@legendapp/state/config/enable$GetSet';
        enable$GetSet();
      `,
      options: [{ allowList: ['enable$GetSet'] }],
    },

    // 4. enable_PeekAssign in allowList — should not be reported
    {
      code: `
        import { enable_PeekAssign } from '@legendapp/state/config/enable_PeekAssign';
        enable_PeekAssign();
      `,
      options: [{ allowList: ['enable_PeekAssign'] }],
    },

    // 5. enableReactTracking in allowList — should not be reported
    {
      code: `
        import { enableReactTracking } from '@legendapp/state/config/enableReactTracking';
        enableReactTracking({ auto: true });
      `,
      options: [{ allowList: ['enableReactTracking'] }],
    },

    // 6. Custom forbidApis that excludes enableReactUse — calling it is fine
    {
      code: `
        import { enableReactUse } from '@legendapp/state/config/enableReactUse';
        enableReactUse();
      `,
      options: [{ forbidApis: ['enable$GetSet', 'enable_PeekAssign'] }],
    },

    // 7. Same-named function from a different (non-tracked) source — not flagged
    {
      code: `
        import { enableReactComponents } from 'some-other-library';
        enableReactComponents();
      `,
    },

    // 8. Import without call expression
    {
      code: `
        import { enableReactNativeComponents } from '@legendapp/state/config/enableReactNativeComponents';
        const ref = enableReactNativeComponents;
      `,
    },
  ],

  invalid: [
    // 1. enable$GetSet() called after import → noEnableShorthand
    {
      code: `
        import { enable$GetSet } from '@legendapp/state/config/enable$GetSet';
        enable$GetSet();
      `,
      errors: [{ messageId: 'noEnableShorthand' }],
    },

    // 2. enable_PeekAssign() called → noEnableShorthand
    {
      code: `
        import { enable_PeekAssign } from '@legendapp/state/config/enable_PeekAssign';
        enable_PeekAssign();
      `,
      errors: [{ messageId: 'noEnableShorthand' }],
    },

    // 3. enableReactTracking() called → noEnableReactTracking
    {
      code: `
        import { enableReactTracking } from '@legendapp/state/config/enableReactTracking';
        enableReactTracking({ auto: true });
      `,
      errors: [{ messageId: 'noEnableReactTracking' }],
    },

    // 4. enableReactUse() called → noEnableReactUse
    {
      code: `
        import { enableReactUse } from '@legendapp/state/config/enableReactUse';
        enableReactUse();
      `,
      errors: [{ messageId: 'noEnableReactUse' }],
    },

    // 5. enableReactComponents() called → noEnableReactComponents
    {
      code: `
        import { enableReactComponents } from '@legendapp/state/config/enableReactComponents';
        enableReactComponents();
      `,
      errors: [{ messageId: 'noEnableReactComponents' }],
    },

    // 6. enableReactNativeComponents() called → noEnableReactNativeComponents
    {
      code: `
        import { enableReactNativeComponents } from '@legendapp/state/config/enableReactNativeComponents';
        enableReactNativeComponents();
      `,
      errors: [{ messageId: 'noEnableReactNativeComponents' }],
    },

    // 7. Aliased import: import { enable$GetSet as directAccess } → error on call
    {
      code: `
        import { enable$GetSet as directAccess } from '@legendapp/state/config/enable$GetSet';
        directAccess();
      `,
      errors: [{ messageId: 'noEnableShorthand' }],
    },

    // 8. Aliased enableReactTracking → still reported
    {
      code: `
        import { enableReactTracking as setupTracking } from '@legendapp/state/config/enableReactTracking';
        setupTracking({ auto: true });
      `,
      errors: [{ messageId: 'noEnableReactTracking' }],
    },

    // 9. Multiple calls → multiple errors
    {
      code: `
        import { enable$GetSet } from '@legendapp/state/config/enable$GetSet';
        import { enableReactUse } from '@legendapp/state/config/enableReactUse';
        enable$GetSet();
        enableReactUse();
      `,
      errors: [
        { messageId: 'noEnableShorthand' },
        { messageId: 'noEnableReactUse' },
      ],
    },

    // 10. Called with arguments — still flagged
    {
      code: `
        import { enableReactComponents } from '@legendapp/state/config/enableReactComponents';
        enableReactComponents({ someOption: true });
      `,
      errors: [{ messageId: 'noEnableReactComponents' }],
    },
  ],
});
