/**
 * Test Event Fixtures
 */

import { faker } from '@faker-js/faker';

export const TEST_EVENTS = {
  offline: {
    pin: '123456',
    status: 'offline' as const,
    config: {
      pages_enabled: { requests: false, display: false },
      event_title: 'Test Event 1',
      welcome_message: 'Welcome to Test Event 1',
      secondary_message: 'Request your favorite songs',
      tertiary_message: 'Have fun!',
    },
  },
  standby: {
    pin: '789012',
    status: 'standby' as const,
    config: {
      pages_enabled: { requests: true, display: false },
      event_title: 'Test Event 2',
      welcome_message: 'Welcome to Test Event 2',
    },
  },
  live: {
    pin: '345678',
    status: 'live' as const,
    config: {
      pages_enabled: { requests: true, display: true },
      event_title: 'Live Test Event',
      welcome_message: 'Welcome to Live Event',
    },
  },
};

export function generateTestEvent() {
  return {
    pin: faker.string.numeric(6),
    status: faker.helpers.arrayElement(['offline', 'standby', 'live']) as 'offline' | 'standby' | 'live',
    config: {
      pages_enabled: {
        requests: faker.datatype.boolean(),
        display: faker.datatype.boolean(),
      },
      event_title: faker.company.catchPhrase(),
      welcome_message: faker.lorem.sentence(),
    },
  };
}


