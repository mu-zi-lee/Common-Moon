import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RoomCode = z.object({ code: z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/) });

function sessionName(code: string) {
  return `lunar_${code}`;
}

async function setSession(code: string, session: string) {
  const { getRequest, setCookie } = await import("@tanstack/react-start/server");
  setCookie(sessionName(code), session, {
    httpOnly: true,
    sameSite: "lax",
    secure: getRequest().url.startsWith("https:"),
    path: "/",
    maxAge: 60 * 60 * 24 * 3,
  });
}

async function readSession(code: string) {
  const { getCookie } = await import("@tanstack/react-start/server");
  return getCookie(sessionName(code));
}

export const createLunarMission = createServerFn({ method: "POST" }).handler(async () => {
  const { createRoom, roomView } = await import("./store.server");
  const { code, session } = await createRoom();
  await setSession(code, session);
  return roomView(code, session);
});

export const joinLunarMission = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => RoomCode.parse(value))
  .handler(async ({ data }) => {
    const { joinRoom, roomView } = await import("./store.server");
    const { code, session } = await joinRoom(data.code, await readSession(data.code));
    await setSession(code, session);
    return roomView(code, session);
  });

export const getLunarMission = createServerFn({ method: "GET" })
  .inputValidator((value: unknown) => RoomCode.parse(value))
  .handler(async ({ data }) => {
    const { roomView } = await import("./store.server");
    return roomView(data.code, await readSession(data.code));
  });
