import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noObservableInJsx } from '../../src/rules/no-observable-in-jsx';
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

ruleTester.run('no-observable-in-jsx', noObservableInJsx, {
  valid: [
    // 1. .get() call — not an observable expression itself
    {
      code: `const el = <div>{count$.get()}</div>;`,
    },
    // 2. Nested member .get()
    {
      code: `const el = <div>{user$.name.get()}</div>;`,
    },
    // 3. Show's `if` prop is allowed
    {
      code: `const el = <Show if={isLoading$}><Spinner /></Show>;`,
    },
    // 4. For's `each` prop is allowed
    {
      code: `const el = <For each={items$}><Item /></For>;`,
    },
    // 5. Switch's `value` prop is allowed
    {
      code: `const el = <Switch value={tab$}><Match /></Switch>;`,
    },
    // 6. Memo children with arrow function — the function itself is not an observable
    {
      code: `const el = <Memo>{() => count$.get()}</Memo>;`,
    },
    // 7. No $ suffix — not an observable
    {
      code: `const el = <div>{count}</div>;`,
    },
    // 8. Plain member expression without $ root
    {
      code: `const el = <div>{someObj.value}</div>;`,
    },
    // 9. Show's `ifReady` prop is allowed
    {
      code: `const el = <Show ifReady={data$}><Content /></Show>;`,
    },
    // 10. Show's `else` prop is allowed
    {
      code: `const el = <Show if={visible$} else={<Fallback />}><Modal /></Show>;`,
    },
    // 11. Child of Computed — allowed
    {
      code: `const el = <Computed>{obs$}</Computed>;`,
    },
    // 12. Custom allowedJsxComponents option
    {
      code: `const el = <MyObserver>{obs$}</MyObserver>;`,
      options: [{ allowedJsxComponents: ['MyObserver'] }],
    },
    // 13. Custom allowedProps option
    {
      code: `const el = <MyComp data={obs$} />;`,
      options: [
        {
          allowedJsxComponents: [],
          allowedProps: { MyComp: ['data'] },
        },
      ],
    },
    // 14. `ref` prop is always allowed (useRef$ pattern)
    {
      code: `const el = <div ref={el$}></div>;`,
    },
    // 15. `ref` on a custom component
    {
      code: `const el = <MyComp ref={containerRef$} />;`,
    },
  ],

  invalid: [
    // 1. Direct observable as child
    {
      code: `const el = <div>{count$}</div>;`,
      errors: [{ messageId: 'observableInJsx', data: { name: 'count$' } }],
    },
    // 2. Member expression (user$.name) as child
    {
      code: `const el = <span>{user$.name}</span>;`,
      errors: [
        { messageId: 'observableInJsx', data: { name: 'user$.name' } },
      ],
    },
    // 3. Observable in non-allowed prop
    {
      code: `const el = <div className={style$}></div>;`,
      errors: [{ messageId: 'observableInJsx', data: { name: 'style$' } }],
    },
    // 4. Observable on non-allowedJsxComponents prop
    {
      code: `const el = <CustomComp value={obs$} />;`,
      errors: [{ messageId: 'observableInJsx', data: { name: 'obs$' } }],
    },
    // 5. Show with a non-allowed prop (e.g., `className`)
    {
      code: `const el = <Show className={style$}><Content /></Show>;`,
      errors: [{ messageId: 'observableInJsx', data: { name: 'style$' } }],
    },
    // 6. For with a non-allowed prop
    {
      code: `const el = <For limit={count$}><Item /></For>;`,
      errors: [{ messageId: 'observableInJsx', data: { name: 'count$' } }],
    },
    // 7. Deeply nested member expression
    {
      code: `const el = <p>{form$.fields.email}</p>;`,
      errors: [
        { messageId: 'observableInJsx', data: { name: 'form$.fields.email' } },
      ],
    },
  ],
});
