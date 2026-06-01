import { NextResponse } from "next/server";

import { type ReminderRecord, saveReminder } from "@/lib/pushStore";

/**
 * Register a single Web Push reminder. The client computes fireAt
 * (epoch ms = start of the dueDate day in the client's timezone) and
 * provides a stable `id` so re-registers replace the existing
 * record. Cancellation goes through /api/push/reminders/[id].
 *
 * Body: {
 *   id: string,             // client-generated, stable across edits
 *   browserId: string,
 *   todoId: string,
 *   title: string,
 *   body: string,
 *   fireAt: number,         // epoch ms
 *   url: string,            // relative URL the click should open
 * }
 */
export async function POST(request: Request) {
    if (!isStorageConfigured()) {
        return NextResponse.json(
            { error: "Push storage is not configured." },
            { status: 503 },
        );
    }
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 },
        );
    }
    if (!raw || typeof raw !== "object") {
        return NextResponse.json(
            { error: "Body must be an object." },
            { status: 400 },
        );
    }
    const record = parseReminder(raw as Record<string, unknown>);
    if (!record) {
        return NextResponse.json(
            { error: "Body is missing required fields." },
            { status: 400 },
        );
    }
    await saveReminder(record);
    return NextResponse.json({ ok: true });
}

function isStorageConfigured(): boolean {
    return Boolean(
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN,
    );
}

function parseReminder(o: Record<string, unknown>): null | ReminderRecord {
    const id = o.id;
    const browserId = o.browserId;
    const todoId = o.todoId;
    const title = o.title;
    const body = o.body;
    const url = o.url;
    const fireAt = o.fireAt;
    if (typeof id !== "string" || id.length < 4) return null;
    if (typeof browserId !== "string" || browserId.length < 8) return null;
    if (typeof todoId !== "string" || todoId.length === 0) return null;
    if (typeof title !== "string" || title.length === 0 || title.length > 200)
        return null;
    if (typeof body !== "string" || body.length > 500) return null;
    if (typeof url !== "string" || !url.startsWith("/")) return null;
    if (typeof fireAt !== "number" || !Number.isFinite(fireAt)) return null;
    return { body, browserId, fireAt, id, title, todoId, url };
}
