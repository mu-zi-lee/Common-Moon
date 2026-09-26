import { describe, expect, it } from "vitest";
import { parseCommand, statusText } from "./commands";
import { newMission } from "./rules";

describe("Telegram commands", () => {
  it("parses group commands and rejects other bot mentions", () => {
    expect(parseCommand("/propose c@RelayBot", "RelayBot")).toEqual({ type: "help" });
    expect(parseCommand("/propose C", "RelayBot")).toEqual({
      type: "propose", action: { type: "move", destination: "C" },
    });
    expect(parseCommand("/status@OtherBot", "RelayBot")).toBeNull();
    expect(parseCommand("/confirm@RelayBot", "RelayBot")).toEqual({ type: "confirm" });
    expect(parseCommand("@RelayBot where are we?", "RelayBot")).toEqual({
      type: "question", question: "where are we?",
    });
  });

  it("keeps status public and out of private role briefings", () => {
    const status = statusText(newMission());
    expect(status).toContain("Oxygen: 6/6");
    expect(status).not.toContain("shadow");
    expect(status).not.toContain("Ridge");
  });
});
