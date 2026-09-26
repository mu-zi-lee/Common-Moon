import { beforeEach, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  members: [] as { slot: number; token_hash: string; name: string }[],
}));

vi.mock("./store.server", () => ({
  admin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "moon-1", code: "MOONTEAM26", state: { phase: "launched" } },
            error: null,
          }),
          order: () => ({
            returns: async () => ({ data: database.members, error: null }),
          }),
        }),
      }),
      insert: async (member: { slot: number; token_hash: string; name: string }) => {
        if (table === "moon_members") database.members.push(member);
        return { error: null };
      },
    }),
  }),
  hashToken: async (token: string) => `hashed:${token}`,
  randomCode: (size: number) => "X".repeat(size),
}));

import { joinProject } from "./project.store.server";

beforeEach(() => {
  database.members = [{ slot: 1, token_hash: "hashed:founder", name: "Founder" }];
});

it("allows a reviewer to join after launch and keeps existing sessions stable", async () => {
  const joined = await joinProject("MOONTEAM26", "Reviewer");
  expect(joined.session).toHaveLength(40);
  expect(database.members[1]).toMatchObject({ slot: 2, name: "Reviewer" });
  expect(await joinProject("MOONTEAM26", "Reviewer", joined.session)).toEqual(joined);
  expect(database.members).toHaveLength(2);
});

it("still enforces the four-member crew limit", async () => {
  database.members.push(
    { slot: 2, token_hash: "two", name: "Two" },
    { slot: 3, token_hash: "three", name: "Three" },
    { slot: 4, token_hash: "four", name: "Four" },
  );
  await expect(joinProject("MOONTEAM26", "Extra")).rejects.toThrow("full");
});
