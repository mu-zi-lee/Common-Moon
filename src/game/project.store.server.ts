import { admin, hashToken, randomCode } from "./store.server";
import { applyProjectAction, newProject, type ProjectAction, type ProjectState } from "./project";

type ProjectRow = {
  id: string;
  code: string;
  pair_code: string;
  telegram_chat_id: string | null;
  state: ProjectState;
  version: number;
};
type MemberRow = {
  id: string;
  project_id: string;
  slot: number;
  name: string;
  token_hash: string;
  bind_code: string;
  telegram_user_id: string | null;
};

const projectColumns = "id, code, pair_code, telegram_chat_id, state, version";
const memberColumns = "id, project_id, slot, name, token_hash, bind_code, telegram_user_id";

async function projectByCode(code: string) {
  const { data, error } = await admin()
    .from("moon_projects")
    .select(projectColumns)
    .eq("code", code)
    .maybeSingle<ProjectRow>();
  if (error) throw new Error(error.message);
  return data;
}

async function members(projectId: string) {
  const { data, error } = await admin()
    .from("moon_members")
    .select(memberColumns)
    .eq("project_id", projectId)
    .order("slot")
    .returns<MemberRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProject(title: string, goal: string, name: string) {
  if (!name.trim()) throw new Error("Enter your crew name");
  const code = randomCode(10);
  const session = randomCode(40);
  const { data, error } = await admin()
    .from("moon_projects")
    .insert({ code, pair_code: randomCode(10), state: newProject(title, goal) })
    .select(projectColumns)
    .single<ProjectRow>();
  if (error || !data) throw new Error(error?.message ?? "Could not create project");
  const { error: memberError } = await admin()
    .from("moon_members")
    .insert({
      project_id: data.id,
      slot: 1,
      name: name.trim().slice(0, 50),
      token_hash: await hashToken(session),
      bind_code: randomCode(10),
    });
  if (memberError) throw new Error(memberError.message);
  return { code, session };
}

export async function joinProject(code: string, name: string, currentSession?: string) {
  const project = await projectByCode(code);
  if (!project) throw new Error("Project not found");
  const crew = await members(project.id);
  if (currentSession) {
    const hash = await hashToken(currentSession);
    if (crew.some((member) => member.token_hash === hash)) return { code, session: currentSession };
  }
  if (!name.trim()) throw new Error("Enter your crew name");
  const slot = [2, 3, 4].find((candidate) => !crew.some((member) => member.slot === candidate));
  if (!slot) throw new Error("This crew is full (4 members)");
  const session = randomCode(40);
  const { error } = await admin()
    .from("moon_members")
    .insert({
      project_id: project.id,
      slot,
      name: name.trim().slice(0, 50),
      token_hash: await hashToken(session),
      bind_code: randomCode(10),
    });
  if (error)
    throw new Error(error.code === "23505" ? "Seat changed; retry joining" : error.message);
  return { code, session };
}

export async function projectView(code: string, session?: string) {
  const project = await projectByCode(code);
  if (!project) throw new Error("Project not found");
  const crew = await members(project.id);
  const hash = session ? await hashToken(session) : "";
  const me = crew.find((member) => member.token_hash === hash);
  if (!me) throw new Error("Join this crew to see its Moon");
  return {
    code: project.code,
    state: project.state,
    slot: me.slot,
    crew: crew.map((member) => ({
      slot: member.slot,
      name: member.name,
      bound: !!member.telegram_user_id,
    })),
    pairCode: project.pair_code,
    bindCode: me.bind_code,
    paired: !!project.telegram_chat_id,
  };
}
export type ProjectView = Awaited<ReturnType<typeof projectView>>;

async function updateProject(
  project: ProjectRow,
  actor: number,
  slots: number[],
  action: ProjectAction,
  messageId?: string,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = attempt ? await projectByCode(project.code) : project;
    if (!current) throw new Error("Project not found");
    if (messageId && current.state.events.some((event) => event.id === messageId)) return false;
    const next = applyProjectAction(current.state, action, actor, slots, Date.now());
    if (messageId) next.events[next.events.length - 1].id = messageId;
    const { data, error } = await admin()
      .from("moon_projects")
      .update({ state: next, version: current.version + 1 })
      .eq("id", current.id)
      .eq("version", current.version)
      .select("id");
    if (error) throw new Error(error.message);
    if (data?.length) return true;
  }
  throw new Error("The Moon changed while updating; retry");
}

export async function actOnProject(
  code: string,
  session: string | undefined,
  action: ProjectAction,
) {
  const project = await projectByCode(code);
  if (!project || !session) throw new Error("Join the project first");
  const crew = await members(project.id);
  const hash = await hashToken(session);
  const me = crew.find((member) => member.token_hash === hash);
  if (!me) throw new Error("Join the project first");
  await updateProject(
    project,
    me.slot,
    crew.map((member) => member.slot),
    action,
  );
  return projectView(code, session);
}

export async function pairProject(pairCode: string, chatId: string) {
  const { data: project, error } = await admin()
    .from("moon_projects")
    .select("id, code, telegram_chat_id")
    .eq("pair_code", pairCode)
    .maybeSingle<{ id: string; code: string; telegram_chat_id: string | null }>();
  if (error || !project) throw new Error("Project pair code not found");
  if (project.telegram_chat_id && project.telegram_chat_id !== chatId)
    throw new Error("Project is paired to another group");
  if (!project.telegram_chat_id) {
    const { data, error: updateError } = await admin()
      .from("moon_projects")
      .update({ telegram_chat_id: chatId })
      .eq("id", project.id)
      .is("telegram_chat_id", null)
      .select("id");
    if (updateError || !data?.length) throw new Error("Pairing changed; retry");
  }
  return project.code;
}

export async function projectForChat(chatId: string) {
  const { data, error } = await admin()
    .from("moon_projects")
    .select(projectColumns)
    .eq("telegram_chat_id", chatId)
    .maybeSingle<ProjectRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function bindProject(chatId: string, code: string, userId: string) {
  const project = await projectForChat(chatId);
  if (!project) throw new Error("Pair this group first");
  const crew = await members(project.id);
  const member = crew.find((entry) => entry.bind_code === code);
  if (!member) throw new Error("Crew bind code not found");
  if (crew.some((entry) => entry.id !== member.id && entry.telegram_user_id === userId))
    throw new Error("Account already bound");
  if (member.telegram_user_id && member.telegram_user_id !== userId)
    throw new Error("Seat already bound");
  const { data, error } = await admin()
    .from("moon_members")
    .update({ telegram_user_id: userId })
    .eq("id", member.id)
    .or(`telegram_user_id.is.null,telegram_user_id.eq.${userId}`)
    .select("id");
  if (error || !data?.length) throw new Error("Seat changed; retry");
  return member.name;
}

export async function actProjectFromTelegram(
  chatId: string,
  userId: string,
  messageId: string,
  action: ProjectAction,
) {
  const project = await projectForChat(chatId);
  if (!project) throw new Error("Pair this group first");
  const crew = await members(project.id);
  const me = crew.find((member) => member.telegram_user_id === userId);
  if (!me) throw new Error("Bind your crew seat first");
  await updateProject(
    project,
    me.slot,
    crew.map((member) => member.slot),
    action,
    messageId,
  );
  const latest = await projectForChat(chatId);
  return latest!.state;
}
