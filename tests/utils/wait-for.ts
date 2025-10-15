/**
 * Wait/Timeout Test Utilities
 */

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  fn: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 5000,
    interval = 100,
    timeoutMessage = 'Timeout waiting for condition',
  } = options;
  
  const startTime = Date.now();
  
  while (true) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue trying
    }
    
    if (Date.now() - startTime > timeout) {
      throw new Error(timeoutMessage);
    }
    
    await wait(interval);
  }
}

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  await waitFor(condition, { timeout, interval, timeoutMessage: 'Condition not met' });
}

export async function waitForElement(
  getElement: () => HTMLElement | null,
  timeout = 5000
): Promise<HTMLElement> {
  return waitFor(
    () => {
      const element = getElement();
      if (!element) throw new Error('Element not found');
      return element;
    },
    { timeout, timeoutMessage: 'Element not found' }
  );
}

export async function retry<T>(
  fn: () => T | Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await wait(delayMs);
      }
    }
  }
  
  throw lastError;
}


