/**
 * App version shown in admin UI.
 * Bumped by scripts/finalise.ts when running with --push.
 * Prefer not editing by hand; finalise push regenerates this file.
 */
export interface AppVersionInfo {
  version: string;
}

export const APP_VERSION_INFO: AppVersionInfo = {
  version: '2.1.5',
};

export const APP_VERSION = APP_VERSION_INFO.version;
