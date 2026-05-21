import { NextResponse } from "next/server";

import { deleteReminder } from "@/lib/pushStore";

/**
 * Cancel a scheduled reminder. Used when the user clears a due
 * date, completes the todo, or deletes it.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Push storage is not configured." },
      { status: 503 },
    );
  }
  const { id } = await context.params;
  if (!id || id.length < 4) {
    return NextResponse.json(
      { error: "Reminder id is required." },
      { status: 400 },
    );
  }
  await deleteReminder(id);
  return NextResponse.json({ ok: true });
}

function isStorageConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}
