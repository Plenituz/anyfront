---
id: api
title: Globals
---

In your test files, Jest puts each of these methods and objects into the global environment. You don't have to require or import anything to use them. However, if you prefer explicit imports, you can do `import {describe, expect, test} from '@jest/globals'`.

## Methods

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc.slice(2)} />

---

## Reference

### `afterAll(fn, timeout)`

Runs a function after all the tests in this file have completed. If the function returns a promise or is a generator, Jest waits for that promise to resolve before continuing.

Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait before aborting. _Note: The default timeout is 5 seconds._

This is often useful if you want to clean up some global setup state that is shared across tests.

For example:

```js
const globalDatabase = makeGlobalDatabase();

function cleanUpDatabase(db) {
  db.cleanUp();
}

afterAll(() => {
  cleanUpDatabase(globalDatabase);
});

test('can find things', () => {
  return globalDatabase.find('thing', {}, results => {
    expect(results.length).toBeGreaterThan(0);
  });
});

test('can insert a thing', () => {
  return globalDatabase.insert('thing', makeThing(), response => {
    expect(response.success).toBeTruthy();
  });
});
```

Here the `afterAll` ensures that `cleanUpDatabase` is called after all tests run.

If `afterAll` is inside a `describe` block, it runs at the end of the describe block.

If you want to run some cleanup after every test instead of after all tests, use `afterEach` instead.

### `afterEach(fn, timeout)`

Runs a function after each one of the tests in this file completes. If the function returns a promise or is a generator, Jest waits for that promise to resolve before continuing.

Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait before aborting. _Note: The default timeout is 5 seconds._

This is often useful if you want to clean up some temporary state that is created by each test.

For example:

```js
const globalDatabase = makeGlobalDatabase();

function cleanUpDatabase(db) {
  db.cleanUp();
}

afterEach(() => {
  cleanUpDatabase(globalDatabase);
});

test('can find things', () => {
  return globalDatabase.find('thing', {}, results => {
    expect(results.length).toBeGreaterThan(0);
  });
});

test('can insert a thing', () => {
  return globalDatabase.insert('thing', makeThing(), response => {
    expect(response.success).toBeTruthy();
  });
});
```

Here the `afterEach` ensures that `cleanUpDatabase` is called after each test runs.

If `afterEach` is inside a `describe` block, it only runs after the tests that are inside this describe block.

If you want to run some cleanup just once, after all of the tests run, use `afterAll` instead.

### `beforeAll(fn, timeout)`

Runs a function before any of the tests in this file run. If the function returns a promise or is a generator, Jest waits for that promise to resolve before running tests.

Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait before aborting. _Note: The default timeout is 5 seconds._

This is often useful if you want to set up some global state that will be used by many tests.

For example:

```js
const globalDatabase = makeGlobalDatabase();

beforeAll(() => {
  // Clears the database and adds some testing data.
  // Jest will wait for this promise to resolve before running tests.
  return globalDatabase.clear().then(() => {
    return globalDatabase.insert({testData: 'foo'});
  });
});

// Since we only set up the database once in this example, it's important
// that our tests don't modify it.
test('can find things', () => {
  return globalDatabase.find('thing', {}, results => {
    expect(results.length).toBeGreaterThan(0);
  });
});
```

Here the `beforeAll` ensures that the database is set up before tests run. If setup was synchronous, you could do this without `beforeAll`. The key is that Jest will wait for a promise to resolve, so you can have asynchronous setup as well.

If `beforeAll` is inside a `describe` block, it runs at the beginning of the describe block.

If you want to run something before every test instead of before any test runs, use `beforeEach` instead.

### `beforeEach(fn, timeout)`

Runs a function before each of the tests in this file runs. If the function returns a promise or is a generator, Jest waits for that promise to resolve before running the test.

Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait before aborting. _Note: The default timeout is 5 seconds._

This is often useful if you want to reset some global state that will be used by many tests.

For example:

```js
const globalDatabase = makeGlobalDatabase();

beforeEach(() => {
  // Clears the database and adds some testing data.
  // Jest will wait for this promise to resolve before running tests.
  return globalDatabase.clear().then(() => {
    return globalDatabase.insert({testData: 'foo'});
  });
});

test('can find things', () => {
  return globalDatabase.find('thing', {}, results => {
    expect(results.length).toBeGreaterThan(0);
  });
});

test('can insert a thing', () => {
  return globalDatabase.insert('thing', makeThing(), response => {
    expect(response.success).toBeTruthy();
  });
});
```

Here the `beforeEach` ensures that the database is reset for each test.

If `beforeEach` is inside a `describe` block, it runs for each test in the describe block.

If you only need to run some setup code once, before any tests run, use `beforeAll` instead.

### `describe(name, fn)`

`describe(name, fn)` creates a block that groups together several related tests. For example, if you have a `myBeverage` object that is supposed to be delicious but not sour, you could test it with:

```js
const myBeverage = {
  delicious: true,
  sour: false,
};

describe('my beverage', () => {
  test('is delicious', () => {
    expect(myBeverage.delicious).toBeTruthy();
  });

  test('is not sour', () => {
    expect(myBeverage.sour).toBeFalsy();
  });
});
```

This isn't required - you can write the `test` blocks directly at the top level. But this can be handy if you prefer your tests to be organized into groups.

You can also nest `describe` blocks if you have a hierarchy of tests:

```js
const binaryStringToNumber = binString => {
  if (!/^[01]+$/.test(binString)) {
    throw new CustomError('Not a binary number.');
  }

  return parseInt(binString, 2);
};

describe('binaryStringToNumber', () => {
  describe('given an invalid binary string', () => {
    test('composed of non-numbers throws CustomError', () => {
      expect(() => binaryStringToNumber('abc')).toThrow(CustomError);
    });

    test('with extra whitespace throws CustomError', () => {
      expect(() => binaryStringToNumber('  100')).toThrow(CustomError);
    });
  });

  describe('given a valid binary string', () => {
    test('returns the correct number', () => {
      expect(binaryStringToNumber('100')).toBe(4);
    });
  });
});
```

### `describe.each(table)(name, fn, timeout)`

Use `describe.each` if you keep duplicating the same test suites with different data. `describe.each` allows you to write the test suite once and pass data in.

`describe.each` is available with two APIs:

#### 1. `describe.each(table)(name, fn, timeout)`

- `table`: `Array` of Arrays with the arguments that are passed into the `fn` for each row.
  - _Note_ If you pass in a 1D array of primitives, internally it will be mapped to a table i.e. `[1, 2, 3] -> [[1], [2], [3]]`
- `name`: `String` the title of the test suite.
  - Generate unique test titles by positionally injecting parameters with [`printf` formatting](https://nodejs.org/api/util.html#util_util_format_format_args):
    - `%p` - [pretty-format](https://www.npmjs.com/package/pretty-format).
    - `%s`- String.
    - `%d`- Number.
    - `%i` - Integer.
    - `%f` - Floating point value.
    - `%j` - JSON.
    - `%o` - Object.
    - `%#` - Index of the test case.
    - `%%` - single percent sign ('%'). This does not consume an argument.
- `fn`: `Function` the suite of tests to be run, this is the function that will receive the parameters in each row as function arguments.
- Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait for each row before aborting. _Note: The default timeout is 5 seconds._

Example:

```js
describe.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('.add(%i, %i)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected);
  });

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected);
  });

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected);
  });
});
```

#### 2. `` describe.each`table`(name, fn, timeout) ``

- `table`: `Tagged Template Literal`
  - First row of variable name column headings separated with `|`
  - One or more subsequent rows of data supplied as template literal expressions using `${value}` syntax.
- `name`: `String` the title of the test suite, use `$variable` to inject test data into the suite title from the tagged template expressions.
  - To inject nested object values use you can supply a keyPath i.e. `$variable.path.to.value`
- `fn`: `Function` the suite of tests to be run, this is the function that will receive the test data object.
- Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait for each row before aborting. _Note: The default timeout is 5 seconds._

Example:

```js
describe.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('$a + $b', ({a, b, expected}) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected);
  });

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected);
  });

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected);
  });
});
```

### `describe.only(name, fn)`

Also under the alias: `fdescribe(name, fn)`

You can use `describe.only` if you want to run only one describe block:

```js
describe.only('my beverage', () => {
  test('is delicious', () => {
    expect(myBeverage.delicious).toBeTruthy();
  });

  test('is not sour', () => {
    expect(myBeverage.sour).toBeFalsy();
  });
});

describe('my other beverage', () => {
  // ... will be skipped
});
```

### `describe.only.each(table)(name, fn)`

Also under the aliases: `fdescribe.each(table)(name, fn)` and `` fdescribe.each`table`(name, fn) ``

Use `describe.only.each` if you want to only run specific tests suites of data driven tests.

`describe.only.each` is available with two APIs:

#### `describe.only.each(table)(name, fn)`

```js
describe.only.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('.add(%i, %i)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected);
  });
});

test('will not be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

#### `` describe.only.each`table`(name, fn) ``

```js
describe.only.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('returns $expected when $a is added to $b', ({a, b, expected}) => {
  test('passes', () => {
    expect(a + b).toBe(expected);
  });
});

test('will not be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

### `describe.skip(name, fn)`

Also under the alias: `xdescribe(name, fn)`

You can use `describe.skip` if you do not want to run the tests of a particular `describe` block:

```js
describe('my beverage', () => {
  test('is delicious', () => {
    expect(myBeverage.delicious).toBeTruthy();
  });

  test('is not sour', () => {
    expect(myBeverage.sour).toBeFalsy();
  });
});

describe.skip('my other beverage', () => {
  // ... will be skipped
});
```

Using `describe.skip` is often a cleaner alternative to temporarily commenting out a chunk of tests. Beware that the `describe` block will still run. If you have some setup that also should be skipped, do it in a `beforeAll` or `beforeEach` block.

### `describe.skip.each(table)(name, fn)`

Also under the aliases: `xdescribe.each(table)(name, fn)` and `` xdescribe.each`table`(name, fn) ``

Use `describe.skip.each` if you want to stop running a suite of data driven tests.

`describe.skip.each` is available with two APIs:

#### `describe.skip.each(table)(name, fn)`

```js
describe.skip.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('.add(%i, %i)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected); // will not be run
  });
});

test('will be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

#### `` describe.skip.each`table`(name, fn) ``

```js
describe.skip.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('returns $expected when $a is added to $b', ({a, b, expected}) => {
  test('will not be run', () => {
    expect(a + b).toBe(expected); // will not be run
  });
});

test('will be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

### `test(name, fn, timeout)`

Also under the alias: `it(name, fn, timeout)`

All you need in a test file is the `test` method which runs a test. For example, let's say there's a function `inchesOfRain()` that should be zero. Your whole test could be:

```js
test('did not rain', () => {
  expect(inchesOfRain()).toBe(0);
});
```

The first argument is the test name; the second argument is a function that contains the expectations to test. The third argument (optional) is `timeout` (in milliseconds) for specifying how long to wait before aborting. _Note: The default timeout is 5 seconds._

> Note: If a **promise is returned** from `test`, Jest will wait for the promise to resolve before letting the test complete. Jest will also wait if you **provide an argument to the test function**, usually called `done`. This could be handy when you want to test callbacks. See how to test async code [here](TestingAsyncCode.md#callbacks).

For example, let's say `fetchBeverageList()` returns a promise that is supposed to resolve to a list that has `lemon` in it. You can test this with:

```js
test('has lemon in it', () => {
  return fetchBeverageList().then(list => {
    expect(list).toContain('lemon');
  });
});
```

Even though the call to `test` will return right away, the test doesn't complete until the promise resolves as well.

### `test.each(table)(name, fn, timeout)`

Also under the alias: `it.each(table)(name, fn)` and `` it.each`table`(name, fn) ``

Use `test.each` if you keep duplicating the same test with different data. `test.each` allows you to write the test once and pass data in.

`test.each` is available with two APIs:

#### 1. `test.each(table)(name, fn, timeout)`

- `table`: `Array` of Arrays with the arguments that are passed into the test `fn` for each row.
  - _Note_ If you pass in a 1D array of primitives, internally it will be mapped to a table i.e. `[1, 2, 3] -> [[1], [2], [3]]`
- `name`: `String` the title of the test block.
  - Generate unique test titles by positionally injecting parameters with [`printf` formatting](https://nodejs.org/api/util.html#util_util_format_format_args):
    - `%p` - [pretty-format](https://www.npmjs.com/package/pretty-format).
    - `%s`- String.
    - `%d`- Number.
    - `%i` - Integer.
    - `%f` - Floating point value.
    - `%j` - JSON.
    - `%o` - Object.
    - `%#` - Index of the test case.
    - `%%` - single percent sign ('%'). This does not consume an argument.
- `fn`: `Function` the test to be run, this is the function that will receive the parameters in each row as function arguments.
- Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait for each row before aborting. _Note: The default timeout is 5 seconds._

Example:

```js
test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('.add(%i, %i)', (a, b, expected) => {
  expect(a + b).toBe(expected);
});
```

#### 2. `` test.each`table`(name, fn, timeout) ``

- `table`: `Tagged Template Literal`
  - First row of variable name column headings separated with `|`
  - One or more subsequent rows of data supplied as template literal expressions using `${value}` syntax.
- `name`: `String` the title of the test, use `$variable` to inject test data into the test title from the tagged template expressions.
  - To inject nested object values use you can supply a keyPath i.e. `$variable.path.to.value`
- `fn`: `Function` the test to be run, this is the function that will receive the test data object.
- Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait for each row before aborting. _Note: The default timeout is 5 seconds._

Example:

```js
test.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('returns $expected when $a is added to $b', ({a, b, expected}) => {
  expect(a + b).toBe(expected);
});
```

### `test.only(name, fn, timeout)`

Also under the aliases: `it.only(name, fn, timeout)`, and `fit(name, fn, timeout)`

When you are debugging a large test file, you will often only want to run a subset of tests. You can use `.only` to specify which tests are the only ones you want to run in that test file.

Optionally, you can provide a `timeout` (in milliseconds) for specifying how long to wait before aborting. _Note: The default timeout is 5 seconds._

For example, let's say you had these tests:

```js
test.only('it is raining', () => {
  expect(inchesOfRain()).toBeGreaterThan(0);
});

test('it is not snowing', () => {
  expect(inchesOfSnow()).toBe(0);
});
```

Only the "it is raining" test will run in that test file, since it is run with `test.only`.

Usually you wouldn't check code using `test.only` into source control - you would use it for debugging, and remove it once you have fixed the broken tests.

### `test.only.each(table)(name, fn)`

Also under the aliases: `it.only.each(table)(name, fn)`, `fit.each(table)(name, fn)`, `` it.only.each`table`(name, fn) `` and `` fit.each`table`(name, fn) ``

Use `test.only.each` if you want to only run specific tests with different test data.

`test.only.each` is available with two APIs:

#### `test.only.each(table)(name, fn)`

```js
test.only.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('.add(%i, %i)', (a, b, expected) => {
  expect(a + b).toBe(expected);
});

test('will not be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

#### `` test.only.each`table`(name, fn) ``

```js
test.only.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('returns $expected when $a is added to $b', ({a, b, expected}) => {
  expect(a + b).toBe(expected);
});

test('will not be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

### `test.skip(name, fn)`

Also under the aliases: `it.skip(name, fn)`, `xit(name, fn)`, and `xtest(name, fn)`

When you are maintaining a large codebase, you may sometimes find a test that is temporarily broken for some reason. If you want to skip running this test, but you don't want to delete this code, you can use `test.skip` to specify some tests to skip.

For example, let's say you had these tests:

```js
test('it is raining', () => {
  expect(inchesOfRain()).toBeGreaterThan(0);
});

test.skip('it is not snowing', () => {
  expect(inchesOfSnow()).toBe(0);
});
```

Only the "it is raining" test will run, since the other test is run with `test.skip`.

You could comment the test out, but it's often a bit nicer to use `test.skip` because it will maintain indentation and syntax highlighting.

### `test.skip.each(table)(name, fn)`

Also under the aliases: `it.skip.each(table)(name, fn)`, `xit.each(table)(name, fn)`, `xtest.each(table)(name, fn)`, `` it.skip.each`table`(name, fn) ``, `` xit.each`table`(name, fn) `` and `` xtest.each`table`(name, fn) ``

Use `test.skip.each` if you want to stop running a collection of data driven tests.

`test.skip.each` is available with two APIs:

#### `test.skip.each(table)(name, fn)`

```js
test.skip.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('.add(%i, %i)', (a, b, expected) => {
  expect(a + b).toBe(expected); // will not be run
});

test('will be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

#### `` test.skip.each`table`(name, fn) ``

```js
test.skip.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('returns $expected when $a is added to $b', ({a, b, expected}) => {
  expect(a + b).toBe(expected); // will not be run
});

test('will be run', () => {
  expect(1 / 0).toBe(Infinity);
});
```

### `test.todo(name)`

Also under the alias: `it.todo(name)`

Use `test.todo` when you are planning on writing tests. These tests will be highlighted in the summary output at the end so you know how many tests you still need todo.

_Note_: If you supply a test callback function then the `test.todo` will throw an error. If you have already implemented the test and it is broken and you do not want it to run, then use `test.skip` instead.

#### API

- `name`: `String` the title of the test plan.

Example:

```js
const add = (a, b) => a + b;

test.todo('add should be associative');
```
