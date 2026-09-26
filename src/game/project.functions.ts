import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildingKinds, type ProjectAction } from "./project";

const Code = z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/);
const Identity = z.object({ code: Code });
const NewProject = z.object({
  title: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(50),
});
const Join = z.object({ code: Code, name: z.string().trim().min(1).max(50) });
const Action = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    title: z.string().trim().min(1).max(90),
    acceptance: z.string().trim().min(1).max(300),
    buildingKind: z.enum(buildingKinds).optional(),
  }),
  z.object({
    type: z.literal("building"),
    taskId: z.string().uuid(),
    buildingKind: z.enum(buildingKinds),
  }),
  z.object({
    type: z.literal("assign"),
    taskId: z.string().uuid(),
    owner: z.number().int().min(1).max(4),
  }),
  z.object({ type: z.literal("launch") }),
  z.object({ type: z.literal("focus"), taskId: z.string().uuid() }),
  z.object({ type: z.literal("pause"), taskId: z.string().uuid() }),
  z.object({
    type: z.literal("submit"),
    taskId: z.string().uuid(),
    evidence: z.string().trim().min(1).max(1000),
  }),
  z.object({ type: z.literal("approve"), taskId: z.string().uuid() }),
  z.object({
    type: z.literal("reject"),
    taskId: z.string().uuid(),
    reason: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("block"),
    taskId: z.string().uuid(),
    reason: z.string().trim().min(1).max(300),
  }),
]);

function cookieName(code: string) {
  return `moon_${code}`;
}
async function setSession(code: string, session: string) {
  const { getRequest, setCookie } = await import("@tanstack/react-start/server");
  setCookie(cookieName(code), session, {
    httpOnly: true,
    sameSite: "lax",
    secure: getRequest().url.startsWith("https:"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
async function readSession(code: string) {
  const { getCookie } = await import("@tanstack/react-start/server");
  return getCookie(cookieName(code));
}

export const createMoonProject = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => NewProject.parse(value))
  .handler(async ({ data }) => {
    const { createProject, projectView } = await import("./project.store.server");
    const { code, session } = await createProject(data.title, data.goal, data.name);
    await setSession(code, session);
    return projectView(code, session);
  });

export const joinMoonProject = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Join.parse(value))
  .handler(async ({ data }) => {
    const { joinProject, projectView } = await import("./project.store.server");
    const { code, session } = await joinProject(data.code, data.name, await readSession(data.code));
    await setSession(code, session);
    return projectView(code, session);
  });

export const getMoonProject = createServerFn({ method: "GET" })
  .inputValidator((value: unknown) => Identity.parse(value))
  .handler(async ({ data }) => {
    const { projectView } = await import("./project.store.server");
    return projectView(data.code, await readSession(data.code));
  });

export const changeMoonProject = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ code: Code, action: Action }).parse(value))
  .handler(async ({ data }) => {
    const { actOnProject } = await import("./project.store.server");
    return actOnProject(data.code, await readSession(data.code), data.action as ProjectAction);
  });
