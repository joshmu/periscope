// File for testing various configuration options
// Contains multiple occurrences of patterns for testing max-count and other options

export function configTestFunction() {
  // Multiple occurrences of "function" for max-count testing
  const result1 = 'function call 1';
  const result2 = 'function call 2'; 
  const result3 = 'function call 3';
  const result4 = 'function call 4';
  const result5 = 'function call 5';
  
  return [result1, result2, result3, result4, result5];
}

// Case sensitivity testing
export function CaseSensitiveTest() {
  const TODO = 'uppercase TODO';
  const todo = 'lowercase todo';
  const Todo = 'mixed case Todo';
  
  return { TODO, todo, Todo };
}

// For testing word boundaries
export function testWordBoundaries() {
  const test = 'exact word test';
  const testing = 'testing is different';
  const pretest = 'pretest should not match';
  const contest = 'contest contains test';
  
  return { test, testing, pretest, contest };
}

// Multiple function definitions for testing
export function helperFunction1() { return 1; }
export function helperFunction2() { return 2; }
export function helperFunction3() { return 3; }
export function helperFunction4() { return 4; }
export function helperFunction5() { return 5; }

// For testing context lines (before/after)
export class ContextTestClass {
  methodBefore() {
    console.log('Line before target');
  }
  
  targetMethod() {
    console.log('TARGET_CONTEXT_TEST'); // This is what we search for
  }
  
  methodAfter() {
    console.log('Line after target');
  }
}