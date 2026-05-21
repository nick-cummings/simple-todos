// Tiny CRUD layer over Upstash Redis for Web Push subscriptions and
// scheduled reminders. Both shapes are plain JSON — Upstash auto-
// serializes for us via @upstash/redis.
//
// Layout:
//   subscription:<browserId>     PushSubscriptionRecord
//   reminder:<reminderId>        ReminderRecord
//
// We deliberately avoid Redis sets/hashes — the volumes are tiny
// (single user, dozens of todos) and keeping things as flat string
// keys keeps the helpers boring and easy to test.

import { Redis } from "@upstash/redis";

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: null | number;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface PushSubscriptionRecord {
  browserId: string;
  createdAt: number;
  subscription: PushSubscriptionJSON;
}

export interface ReminderRecord {
  body: string;
  browserId: string;
  fireAt: number; // epoch ms — earliest time the cron may dispatch
  id: string;
  title: string;
  todoId: string;
  url: string; // relative path the notification click opens
}

const SUBSCRIPTION_PREFIX = "subscription:";
const REMINDER_PREFIX = "reminder:";

// Module-scoped client. Constructed lazily on first use so that
// modules importing this file don't blow up at import time when the
// env vars are missing (route handlers and tests both do their own
// env gating before calling in).
let client: null | Redis = null;

/** Test-only: replace the cached client. */
export function __setRedisClient(c: null | Redis): void {
  client = c;
}

export async function deleteReminder(id: string): Promise<void> {
  await getClient().del(REMINDER_PREFIX + id);
}

// ---------- subscriptions ----------

export async function deleteSubscription(browserId: string): Promise<void> {
  await getClient().del(SUBSCRIPTION_PREFIX + browserId);
}

export async function getReminder(id: string): Promise<null | ReminderRecord> {
  const raw = await getClient().get<string>(REMINDER_PREFIX + id);
  return parseRecord<ReminderRecord>(raw);
}

export async function getSubscription(
  browserId: string,
): Promise<null | PushSubscriptionRecord> {
  const raw = await getClient().get<string>(SUBSCRIPTION_PREFIX + browserId);
  return parseRecord<PushSubscriptionRecord>(raw);
}

// ---------- reminders ----------

/**
 * Scan all reminders. Used by the cron handler. Returns parsed
 * records, silently skipping any that fail to parse (Upstash data
 * lives across deploys, so a schema bump shouldn't crash the cron).
 */
export async function listReminders(): Promise<ReminderRecord[]> {
  const c = getClient();
  const keys: string[] = [];
  let cursor: number | string = 0;
  do {
    const result = (await c.scan(cursor, {
      count: 100,
      match: `${REMINDER_PREFIX}*`,
    })) as [number | string, string[]];
    keys.push(...result[1]);
    cursor = result[0];
  } while (cursor !== 0 && cursor !== "0");
  if (keys.length === 0) return [];
  // mget tolerates string-or-null; map through parseRecord.
  const raws = await c.mget<(null | string)[]>(...keys);
  return raws
    .map((r) => parseRecord<ReminderRecord>(r))
    .filter((r): r is ReminderRecord => r !== null);
}

export async function saveReminder(record: ReminderRecord): Promise<void> {
  await getClient().set(REMINDER_PREFIX + record.id, JSON.stringify(record));
}

export async function saveSubscription(
  record: PushSubscriptionRecord,
): Promise<void> {
  await getClient().set(
    SUBSCRIPTION_PREFIX + record.browserId,
    JSON.stringify(record),
  );
}

function getClient(): Redis {
  if (client !== null) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are required for push storage",
    );
  }
  client = new Redis({ token, url });
  return client;
}

function parseRecord<T>(raw: null | string | T): null | T {
  if (raw === null) return null;
  if (typeof raw === "object") return raw;
  // Otherwise it's a JSON string from the Upstash client; parse and
  // return null on malformed payloads instead of throwing.
  try {
    return JSON.parse(raw as string) as T;
  } catch {
    return null;
  }
}
