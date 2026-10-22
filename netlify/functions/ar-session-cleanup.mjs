import { cleanupExpiredSessions } from './ar-session.mjs';

export const config = { schedule: '@hourly' };

export default async () => {
  const deleted = await cleanupExpiredSessions();
  console.log('ar-session-cleanup-complete', { deleted });
};
