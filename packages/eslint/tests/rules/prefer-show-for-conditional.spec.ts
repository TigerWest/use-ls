import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { preferShowForConditional } from '../../src/rules/prefer-show-for-conditional';
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
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('prefer-show-for-conditional', preferShowForConditional, {
  valid: [
    // 1. Show component with if prop — no warning
    {
      code: `const jsx = <Show if={isVisible$}><Modal /></Show>;`,
    },
    // 2. Plain boolean condition (not observable) — no warning
    {
      code: `const jsx = <div>{isVisible && <Modal />}</div>;`,
    },
    // 3. Non-$ condition — no warning
    {
      code: `const jsx = <div>{count > 0 && <span>items</span>}</div>;`,
    },
    // 4. Observable condition but branch is a string — requireJsxBranch=true (default) skips
    {
      code: `const jsx = <div>{isLoading$ && 'Loading...'}</div>;`,
    },
    // 5. Observable condition but both branches are strings in ternary
    {
      code: `const jsx = <div>{isActive$ ? 'yes' : 'no'}</div>;`,
    },
    // 6. Already inside a Show component
    {
      code: `
        const jsx = (
          <Show if={isVisible$}>
            {isActive$ && <div>active</div>}
          </Show>
        );
      `,
    },
    // 7. Already inside Auto component (also a show component by default)
    {
      code: `
        const jsx = (
          <Auto if={isVisible$}>
            {isActive$ && <div>active</div>}
          </Auto>
        );
      `,
    },
    // 8. Nullish coalescing (??) — not checked (v1 exclusion)
    {
      code: `const jsx = <div>{value$ ?? <Fallback />}</div>;`,
    },
    // 9. Not inside JSX expression container (not JSX context)
    {
      code: `const result = isVisible$ && doSomething();`,
    },
    // 10. Observable && in JSX attribute value — cannot use <Show>, so ignore
    {
      code: `const jsx = <Button disabled={isDisabled$ && someCondition} />;`,
    },
    // 11. Observable ternary in JSX attribute value — prop value, not rendered child
    {
      code: `const jsx = <Component className={isActive$ ? 'active' : 'inactive'} />;`,
    },
    // 12. Observable && JSXElement inside a prop — still a prop, ignore
    {
      code: `const jsx = <Tooltip content={isVisible$ && <TooltipBody />} />;`,
    },
    // 13. $.get() ternary in attribute — ignore
    {
      code: `const jsx = <input aria-label={isLoading$.get() ? 'Loading' : 'Ready'} />;`,
    },
    // 14. Chained .get() in attribute — prop value, not rendered child
    {
      code: `const jsx = <input aria-label={todo$.isLoading.get() ? 'Loading' : 'Ready'} />;`,
    },
    // 15. Chained .get() && string — requireJsxBranch=true (default) skips
    {
      code: `const jsx = <div>{todo$.isLoading.get() && 'Loading...'}</div>;`,
    },
  ],

  invalid: [
    // 1. Observable && JSXElement
    {
      code: `const jsx = <div>{isVisible$ && <Modal />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 2. $.get() && JSXElement
    {
      code: `const jsx = <div>{isLoading$.get() && <Spinner />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 3. $.peek() && JSXElement
    {
      code: `const jsx = <div>{isActive$.peek() && <Panel />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 4. Observable || JSXElement
    {
      code: `const jsx = <div>{error$ || <Fallback />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 5. Observable ? JSXElement : JSXElement (ternary, consequent is JSX)
    {
      code: `const jsx = <div>{isLoading$.get() ? <Spinner /> : <Content />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 6. Observable ? JSXElement : string (consequent is JSX, alternate is not)
    {
      code: `const jsx = <div>{isLoading$.get() ? <Spinner /> : null}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 7. Observable ? string : JSXElement (alternate is JSX)
    {
      code: `const jsx = <div>{isLoading$.get() ? null : <Content />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 8. Direct observable in ternary (no .get())
    {
      code: `const jsx = <div>{isActive$ ? <A /> : <B />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 9. Custom showComponents option still warns on outer non-show context
    {
      code: `const jsx = <div>{isVisible$ && <Modal />}</div>;`,
      options: [{ showComponents: ['MyShow'] }],
      errors: [{ messageId: 'preferShow' }],
    },
    // 10. requireJsxBranch: false warns on string branch too
    {
      code: `const jsx = <div>{isLoading$ && 'Loading...'}</div>;`,
      options: [{ requireJsxBranch: false }],
      errors: [{ messageId: 'preferShow' }],
    },
    // 11. Chained .get() && JSXElement — todo$.isLoading.get() pattern
    {
      code: `const jsx = <div>{todo$.isLoading.get() && <Spinner />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 12. Chained .peek() && JSXElement
    {
      code: `const jsx = <div>{todo$.isError.peek() && <ErrorMsg />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 13. Chained .get() ternary
    {
      code: `const jsx = <div>{todo$.isSuccess.get() ? <Content /> : <Fallback />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
    // 14. Deeply chained — user$.profile.avatar.loaded.get()
    {
      code: `const jsx = <div>{user$.profile.avatar.loaded.get() && <Img />}</div>;`,
      errors: [{ messageId: 'preferShow' }],
    },
  ],
});
