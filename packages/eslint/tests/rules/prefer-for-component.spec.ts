import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { preferForComponent } from '../../src/rules/prefer-for-component';
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

ruleTester.run('prefer-for-component', preferForComponent, {
  valid: [
    // 1. Already using For component
    {
      code: `
        const jsx = (
          <For each={items$}>
            {(item$) => <li>{item$.name.get()}</li>}
          </For>
        );
      `,
    },
    // 2. .map() on a plain (non-observable) variable — no $ suffix
    {
      code: `const jsx = <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>;`,
    },
    // 3. Already inside a For component
    {
      code: `
        const jsx = (
          <For each={outer$}>
            {(item$) => (
              <div>
                {item$.children$.get().map((child) => <span key={child.id}>{child.name}</span>)}
              </div>
            )}
          </For>
        );
      `,
    },
    // 7. filter().map() chain — v1 limitation: only direct $ .map() or $.get().map() detected
    {
      code: `const jsx = <ul>{items$.get().filter(Boolean).map((item) => <li key={item.id}>{item.name}</li>)}</ul>;`,
    },
  ],

  invalid: [
    // 1. items$.get().map() with key prop (implicit JSX return)
    {
      code: `const jsx = <ul>{items$.get().map((item) => <li key={item.id}>{item.name}</li>)}</ul>;`,
      errors: [{ messageId: 'preferFor' }],
    },
    // 2. Direct items$.map() with key prop
    {
      code: `const jsx = <ul>{items$.map((item$) => <li key={item$.id.get()}>{item$.name.get()}</li>)}</ul>;`,
      errors: [{ messageId: 'preferFor' }],
    },
    // 3. $.peek().map() with key prop
    {
      code: `const jsx = <ul>{items$.peek().map((item) => <li key={item.id}>{item.name}</li>)}</ul>;`,
      errors: [{ messageId: 'preferFor' }],
    },
    // 4. No key prop — warned with default requireKeyProp: false
    {
      code: `const jsx = <ul>{items$.get().map((item) => <li>{item.name}</li>)}</ul>;`,
      errors: [{ messageId: 'preferFor' }],
    },
    // 5. Block body arrow function — warned with default requireKeyProp: false
    {
      code: `const jsx = <ul>{items$.get().map((item) => { return <li key={item.id}>{item.name}</li>; })}</ul>;`,
      errors: [{ messageId: 'preferFor' }],
    },
    // 6. Function reference callback — warned with default requireKeyProp: false
    {
      code: `const jsx = <ul>{items$.get().map(renderItem)}</ul>;`,
      errors: [{ messageId: 'preferFor' }],
    },
    // 7. Custom forComponents — still warns when not inside custom For
    {
      code: `const jsx = <ul>{items$.get().map((item) => <li key={item.id}>{item.name}</li>)}</ul>;`,
      options: [{ forComponents: ['VirtualList'] }],
      errors: [{ messageId: 'preferFor' }],
    },
  ],
});
