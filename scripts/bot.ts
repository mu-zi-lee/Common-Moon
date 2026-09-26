import { Spectrum } from "spectrum-ts";
import { telegram } from "spectrum-ts/providers/telegram";
import { actFromTelegram, bindTelegram, pairTelegram, roomForChat } from "../src/game/store.server";
import { HELP_TEXT, parseCommand, statusText } from "../src/game/commands";
import {
  actProjectFromTelegram,
  bindProject,
  pairProject,
  projectForChat,
} from "../src/game/project.store.server";
import {
  parseProjectCommand,
  PROJECT_HELP,
  projectStatusText,
  resolveProjectAction,
} from "../src/game/project.commands";

const projectId = process.env.PHOTON_PROJECT_ID;
const projectSecret = process.env.PHOTON_PROJECT_SECRET;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
if (!projectId || !projectSecret || !botToken) {
  throw new Error(
    "Set PHOTON_PROJECT_ID, PHOTON_PROJECT_SECRET and TELEGRAM_BOT_TOKEN before starting the bot",
  );
}

const app = await Spectrum({
  projectId,
  projectSecret,
  providers: [telegram.config({ botToken })],
});

async function answerQuestion(question: string, stateText: string) {
  const key = process.env.AI_API_KEY;
  const base = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;
  if (!key || !base || !model)
    return `${stateText}\nCrew, compare your own charts before deciding the route.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 130,
        messages: [
          {
            role: "system",
            content:
              "You are Lunar Relay mission control. Only know the public telemetry below. " +
              "Never claim to see either player's private chart, never choose a route for the crew, " +
              "never change mission state, never disclose secrets. Answer in 1-2 concise sentences.\n\n" +
              stateText,
          },
          { role: "user", content: question },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI service returned ${response.status}`);
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return result.choices?.[0]?.message?.content?.slice(0, 700) || stateText;
  } catch (error) {
    console.warn("AI reply unavailable", error);
    return `${stateText}\nMission control is on standby. Use /status for current telemetry.`;
  } finally {
    clearTimeout(timeout);
  }
}

async function answerProjectQuestion(question: string, stateText: string) {
  const key = process.env.AI_API_KEY;
  const base = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;
  if (!key || !base || !model)
    return `${stateText}\nTry naming the smallest reviewable deliverable and who can verify it.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 240,
        messages: [
          {
            role: "system",
            content:
              "You are Common Moon, a thoughtful project teammate in a Telegram group. " +
              "Use the current project state below to propose a specific next step, a helpful split of work, or a way past a blocker. " +
              "Do not claim a task is done, change state, invent teammates or pretend to have seen their work. " +
              "A human must use commands to add, assign, submit, or approve. Keep it short and useful.\n\n" +
              stateText,
          },
          { role: "user", content: question },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI service returned ${response.status}`);
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return (
      result.choices?.[0]?.message?.content?.slice(0, 1000) || "No suggestion available right now."
    );
  } catch (error) {
    console.warn("Project agent unavailable", error);
    return "I couldn't reach the planning model. Use /status to see what needs review or help.";
  } finally {
    clearTimeout(timeout);
  }
}

console.log("Lunar Relay mission control listening for Telegram crew messages");
for await (const [space, message] of app.messages) {
  if (message.direction !== "inbound" || message.content.type !== "text" || !message.sender)
    continue;
  const command = parseCommand(message.content.text, botUsername);
  const projectCommand = parseProjectCommand(message.content.text, botUsername);
  if (!command && !projectCommand) continue;
  const chatId = space.id;
  const userId = message.sender.id;
  try {
    if (projectCommand?.type === "pair") {
      if (!chatId.startsWith("-"))
        throw new Error("Create a Telegram group with your crewmate first");
      try {
        const code = await pairProject(projectCommand.code, chatId);
        await space.send(
          `COMMON MOON / Connected to project ${code}. Each teammate: /bind YOUR_CODE`,
        );
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "Project pair code not found")
          throw error;
        const code = await pairTelegram(projectCommand.code, chatId);
        await space.send(
          `LUNAR RELAY / Linked to tutorial mission ${code}. Each player: /bind YOUR_CODE`,
        );
      }
      continue;
    }
    const project = await projectForChat(chatId);
    if (project) {
      if (!projectCommand) continue;
      if (projectCommand.type === "bind") {
        const who = await bindProject(chatId, projectCommand.code, userId);
        await space.send(`${who} joined the Common Moon crew.`);
      } else if (projectCommand.type === "help") {
        await space.send(PROJECT_HELP);
      } else if (projectCommand.type === "status") {
        await space.send(projectStatusText(project.state));
      } else if (projectCommand.type === "plan" || projectCommand.type === "question") {
        await space.send(
          await answerProjectQuestion(
            projectCommand.type === "plan"
              ? "Suggest one useful next step based on the current tasks and blockers."
              : projectCommand.question,
            projectStatusText(project.state),
          ),
        );
      } else if (projectCommand.type === "action") {
        const action = resolveProjectAction(project.state, projectCommand.action);
        const next = await actProjectFromTelegram(
          chatId,
          userId,
          `${chatId}:${message.id}`,
          action,
        );
        await space.send(projectStatusText(next));
      }
      continue;
    }
    if (!command) continue;
    if (command.type === "help") {
      await space.send(`${PROJECT_HELP}\n\nTUTORIAL / RESCUE MISSION\n${HELP_TEXT}`);
      continue;
    }
    if (command.type === "pair") continue;
    if (command.type === "bind") {
      const room = await roomForChat(chatId);
      if (!room) throw new Error("Pair this group first with /pair CODE");
      const role = await bindTelegram(room.code, chatId, command.code, userId);
      await space.send(`${role.toUpperCase()} connected. Keep private charts on your own screen.`);
      continue;
    }
    const room = await roomForChat(chatId);
    if (!room) throw new Error("Pair this group first with /pair CODE");
    if (command.type === "status") {
      await space.send(statusText(room.state));
      continue;
    }
    if (command.type === "question") {
      await space.send(await answerQuestion(command.question, statusText(room.state)));
      continue;
    }
    const result = await actFromTelegram(
      chatId,
      userId,
      `${chatId}:${message.id}`,
      command.type === "propose"
        ? { type: "propose", action: command.action }
        : { type: command.type },
    );
    if (!result.duplicate) await space.send(statusText(result.state));
  } catch (error) {
    console.error("Mission control rejected command", error);
    await space.send(
      `MISSION CONTROL / ${error instanceof Error ? error.message : "Could not process command"}`,
    );
  }
}
