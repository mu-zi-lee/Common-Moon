import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  confirm,
  newMission,
  propose,
  publicMission,
  restart,
  type Action,
  type MissionState,
  type Role,
} from "./rules";

type MissionRow = {
  id: string;
  code: string;
  pair_code: string;
  telegram_chat_id: string | null;
  state: MissionState;
  version: number;
};

type PlayerRow = {
  id: string;
  mission_id: string;
  role: Role;
  token_hash: string;
  bind_code: string;
  telegram_user_id: string | null;
};

let client: SupabaseClient | undefined;

export function admin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Mission service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  client = createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function randomCode(size: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createRoom() {
  const code = randomCode(10);
  const pairCode = randomCode(10);
  const session = randomCode(40);
  const { data: room, error } = await admin()
    .from("lunar_missions")
    .insert({ code, pair_code: pairCode, state: newMission() })
    .select("id, code, pair_code, telegram_chat_id, state, version")
    .single<MissionRow>();
  if (error || !room) throw new Error(error?.message ?? "Could not create mission");
  const { error: playerError } = await admin().from("lunar_players").insert({
    mission_id: room.id,
    role: "navigator",
    token_hash: await hashToken(session),
    bind_code: randomCode(10),
  });
  if (playerError) throw new Error(playerError.message);
  return { code, session };
}

export async function findRoom(code: string) {
  const { data, error } = await admin()
    .from("lunar_missions")
    .select("id, code, pair_code, telegram_chat_id, state, version")
    .eq("code", code)
    .maybeSingle<MissionRow>();
  if (error) throw new Error(error.message);
  return data;
}

async function getPlayers(missionId: string) {
  const { data, error } = await admin()
    .from("lunar_players")
    .select("id, mission_id, role, token_hash, bind_code, telegram_user_id")
    .eq("mission_id", missionId)
    .returns<PlayerRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function joinRoom(code: string, currentSession?: string) {
  const room = await findRoom(code);
  if (!room) throw new Error("Mission not found");
  const players = await getPlayers(room.id);
  if (currentSession) {
    const hash = await hashToken(currentSession);
    if (players.some((player) => player.token_hash === hash)) return { code, session: currentSession };
  }
  if (players.some((player) => player.role === "engineer")) throw new Error("Both crew seats are occupied");
  const session = randomCode(40);
  const { error } = await admin().from("lunar_players").insert({
    mission_id: room.id,
    role: "engineer",
    token_hash: await hashToken(session),
    bind_code: randomCode(10),
  });
  if (error) throw new Error(error.code === "23505" ? "Both crew seats are occupied" : error.message);
  return { code, session };
}

export async function roomView(code: string, session?: string) {
  const room = await findRoom(code);
  if (!room) throw new Error("Mission not found");
  const players = await getPlayers(room.id);
  const hash = session ? await hashToken(session) : null;
  const mine = players.find((player) => player.token_hash === hash);
  return {
    code: room.code,
    state: publicMission(room.state),
    role: mine?.role ?? null,
    pairCode: mine?.role ? room.pair_code : null,
    bindCode: mine?.bind_code ?? null,
    paired: !!room.telegram_chat_id,
    crew: {
      navigator: players.some((player) => player.role === "navigator"),
      engineer: players.some((player) => player.role === "engineer"),
      navigatorBound: players.some((player) => player.role === "navigator" && !!player.telegram_user_id),
      engineerBound: players.some((player) => player.role === "engineer" && !!player.telegram_user_id),
    },
  };
}

export type RoomView = Awaited<ReturnType<typeof roomView>>;

export async function pairTelegram(pairCode: string, chatId: string) {
  const { data: room, error } = await admin()
    .from("lunar_missions")
    .select("id, code, telegram_chat_id")
    .eq("pair_code", pairCode)
    .maybeSingle<{ id: string; code: string; telegram_chat_id: string | null }>();
  if (error || !room) throw new Error("Pair code not found");
  if (room.telegram_chat_id && room.telegram_chat_id !== chatId) throw new Error("Mission is paired to a different group");
  if (!room.telegram_chat_id) {
    const { data: bound, error: bindError } = await admin()
      .from("lunar_missions")
      .update({ telegram_chat_id: chatId })
      .eq("id", room.id)
      .is("telegram_chat_id", null)
      .select("id");
    if (bindError || !bound?.length) throw new Error("Mission pairing changed; retry");
  }
  return room.code;
}

export async function bindTelegram(code: string, chatId: string, bindCode: string, userId: string) {
  const room = await findRoom(code);
  if (!room || room.telegram_chat_id !== chatId) throw new Error("Pair this group to the mission first");
  const players = await getPlayers(room.id);
  const player = players.find((entry) => entry.bind_code === bindCode);
  if (!player) throw new Error("Crew code not found");
  if (players.some((entry) => entry.id !== player.id && entry.telegram_user_id === userId)) {
    throw new Error("That account already has a role");
  }
  if (player.telegram_user_id && player.telegram_user_id !== userId) throw new Error("Role is bound to another account");
  const { data: updated, error } = await admin()
    .from("lunar_players")
    .update({ telegram_user_id: userId })
    .eq("id", player.id)
    .or(`telegram_user_id.is.null,telegram_user_id.eq.${userId}`)
    .select("id");
  if (error || !updated?.length) throw new Error(error?.message ?? "Role was bound by another account");
  return player.role;
}

export async function roomForChat(chatId: string) {
  const { data, error } = await admin()
    .from("lunar_missions")
    .select("id, code, pair_code, telegram_chat_id, state, version")
    .eq("telegram_chat_id", chatId)
    .maybeSingle<MissionRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function actFromTelegram(
  chatId: string,
  userId: string,
  messageId: string,
  operation: { type: "propose"; action: Action } | { type: "confirm" } | { type: "restart" },
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const room = await roomForChat(chatId);
    if (!room) throw new Error("This group is not paired to a mission");
    const players = await getPlayers(room.id);
    const player = players.find((entry) => entry.telegram_user_id === userId);
    if (!player) throw new Error("Bind your crew role first");
    if (room.state.seenMessages?.includes(messageId)) return { state: publicMission(room.state), duplicate: true };
    if (operation.type === "restart" && player.role !== "navigator") throw new Error("Only the navigator can restart");
    const now = Date.now();
    const next =
      operation.type === "propose"
        ? propose(room.state, operation.action, player.id, now)
        : operation.type === "confirm"
          ? confirm(room.state, player.id, now)
          : restart(room.state, player.id, now);
    next.seenMessages = [...(next.seenMessages ?? []).slice(-199), messageId];
    const { data, error } = await admin()
      .from("lunar_missions")
      .update({ state: next, version: room.version + 1 })
      .eq("id", room.id)
      .eq("version", room.version)
      .select("id");
    if (error) throw new Error(error.message);
    if (data?.length) return { state: publicMission(next), duplicate: false };
  }
  throw new Error("Mission changed while confirming; retry");
}
