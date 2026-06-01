import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
    default: {
        sendNotification: (...args: unknown[]) => sendNotification(...args),
        setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    },
}));

import type { PushSubscriptionJSON, ReminderRecord } from "./pushStore";

import { __resetWebPush, sendReminderPush } from "./webPush";

const SUB: PushSubscriptionJSON = {
    endpoint: "https://example.com/push/abc",
    keys: { auth: "auth", p256dh: "p256" },
};

const REMINDER: ReminderRecord = {
    body: "Due today",
    browserId: "b1",
    fireAt: 0,
    id: "r1",
    title: "Take out trash",
    todoId: "t1",
    url: "/?todo=t1",
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    process.env = {
        ...ORIGINAL_ENV,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub-key",
        VAPID_PRIVATE_KEY: "priv-key",
        VAPID_SUBJECT: "mailto:owner@example.com",
    };
    sendNotification.mockReset();
    setVapidDetails.mockReset();
    __resetWebPush();
});

afterEach(() => {
    process.env = ORIGINAL_ENV;
});

describe("sendReminderPush", () => {
    it("configures web-push once and sends a JSON payload", async () => {
        sendNotification.mockResolvedValueOnce({ statusCode: 201 });
        const result = await sendReminderPush(SUB, REMINDER);
        expect(result).toEqual({ status: "sent" });
        expect(setVapidDetails).toHaveBeenCalledTimes(1);
        expect(setVapidDetails).toHaveBeenCalledWith(
            "mailto:owner@example.com",
            "pub-key",
            "priv-key",
        );
        const [subArg, payloadArg] = sendNotification.mock.calls[0];
        expect(subArg).toEqual(SUB);
        expect(JSON.parse(payloadArg as string)).toEqual({
            body: "Due today",
            title: "Take out trash",
            todoId: "t1",
            url: "/?todo=t1",
        });
    });

    it("does not reconfigure web-push on subsequent calls", async () => {
        sendNotification.mockResolvedValue({ statusCode: 201 });
        await sendReminderPush(SUB, REMINDER);
        await sendReminderPush(SUB, REMINDER);
        expect(setVapidDetails).toHaveBeenCalledTimes(1);
        expect(sendNotification).toHaveBeenCalledTimes(2);
    });

    it("returns 'expired' on 404 from the push service", async () => {
        sendNotification.mockRejectedValueOnce({ statusCode: 404 });
        const result = await sendReminderPush(SUB, REMINDER);
        expect(result).toEqual({ status: "expired", statusCode: 404 });
    });

    it("returns 'expired' on 410 Gone", async () => {
        sendNotification.mockRejectedValueOnce({ statusCode: 410 });
        const result = await sendReminderPush(SUB, REMINDER);
        expect(result).toEqual({ status: "expired", statusCode: 410 });
    });

    it("returns 'failed' on other errors", async () => {
        sendNotification.mockRejectedValueOnce({ statusCode: 500 });
        const result = await sendReminderPush(SUB, REMINDER);
        expect(result).toEqual({ status: "failed", statusCode: 500 });
    });

    it("returns 'failed' with undefined statusCode on plain errors", async () => {
        sendNotification.mockRejectedValueOnce(new Error("network"));
        const result = await sendReminderPush(SUB, REMINDER);
        expect(result.status).toBe("failed");
    });

    it("throws when VAPID env is missing", async () => {
        delete process.env.VAPID_PRIVATE_KEY;
        __resetWebPush();
        await expect(sendReminderPush(SUB, REMINDER)).rejects.toThrow(/VAPID/);
    });
});
