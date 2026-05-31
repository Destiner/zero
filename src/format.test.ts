import { expect, test } from 'bun:test';

import summarizeInput from './format';

test('summarizes tool input on one line', (): void => {
  expect(summarizeInput({ command: 'printf "hello\\nworld"' })).toBe(
    '{"command":"printf \\"hello\\\\nworld\\""}',
  );
});

test('truncates long tool input', (): void => {
  expect(summarizeInput({ command: 'x'.repeat(150) })).toHaveLength(120);
});
