import { describe, expect, it } from "vitest";
import { errorMessage, nextStatuses, parseTasks } from "./tasks.ts";

describe("nextStatuses", () => {
  it("offers exactly the moves the API accepts", () => {
    expect(nextStatuses("todo")).toEqual(["in_progress"]);
    expect(nextStatuses("in_progress")).toEqual(["todo", "done"]);
    expect(nextStatuses("done")).toEqual([]);
  });
});

describe("parseTasks", () => {
  it("keeps only the fields the interface uses", () => {
    const json = [{ id: "a", title: "ship it", status: "todo", createdAt: "2026-01-01T00:00:00Z" }];
    expect(parseTasks(json)).toEqual([{ id: "a", title: "ship it", status: "todo" }]);
  });

  it("rejects a response that is not what the API documents", () => {
    expect(() => parseTasks({ tasks: [] })).toThrow(/list of tasks/);
    expect(() => parseTasks([null])).toThrow(/task 0 is not an object/);
    expect(() => parseTasks([{ id: "a", title: "x", status: "DONE" }])).toThrow(/known status/);
  });
});

describe("errorMessage", () => {
  it("prefers the service's message and falls back to the status", async () => {
    expect(await errorMessage(new Response('{"error":"title must not be empty"}', { status: 422 }))).toBe("title must not be empty");
    expect(await errorMessage(new Response("<html>", { status: 502 }))).toBe("request failed with status 502");
  });
});
