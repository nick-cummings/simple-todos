import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteReminderMock = vi.fn();

vi.mock("@/lib/pushStore", () => ({
    deleteReminder: (...a: unknown[]) => deleteReminderMock(...a),
}));

const ORIGINAL_ENV = { ...process.env };

async function importRoute() {
    vi.resetModules();
    return await import("./route");
}

beforeEach(() => {
    process.env = {
        ...ORIGINAL_ENV,
        UPSTASH_REDIS_REST_TOKEN: "tok",
        UPSTASH_REDIS_REST_URL: "https://r",
    };
    deleteReminderMock.mockReset();
});

afterEach(() => {
    process.env = ORIGINAL_ENV;
});

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/push/reminders/[id]", () => {
    it("deletes the reminder by id", async () => {
        const { DELETE } = await importRoute();
        const res = await DELETE(
            new Request("http://localhost/api/push/reminders/rem-1", {
                method: "DELETE",
            }),
            ctx("rem-1"),
        );
        expect(res.status).toBe(200);
        expect(deleteReminderMock).toHaveBeenCalledWith("rem-1");
    });

    it("rejects a too-short id", async () => {
        const { DELETE } = await importRoute();
        const res = await DELETE(
            new Request("http://localhost/api/push/reminders/x", {
                method: "DELETE",
            }),
            ctx("x"),
        );
        expect(res.status).toBe(400);
        expect(deleteReminderMock).not.toHaveBeenCalled();
    });

    it("returns 503 when storage isn't configured", async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        const { DELETE } = await importRoute();
        const res = await DELETE(
            new Request("http://localhost/api/push/reminders/rem-1", {
                method: "DELETE",
            }),
            ctx("rem-1"),
        );
        expect(res.status).toBe(503);
    });
});
