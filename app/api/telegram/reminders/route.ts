import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = process.env.TOKEN_ID!;
const bot = new TelegramBot(TELEGRAM_TOKEN);

// In-memory storage (temporary; replace with DB)
const reminders: Record<string, { chatId: number; message: string; time: string }> = {};

export async function POST(req: NextRequest) {
  const { msg } = await req.json();
  const chatId = msg.chat.id;
  const text = msg.text as string;

  const [time, ...taskParts] = text.split(" ");
  const task = taskParts.join(" ");
  const reminderId = `${chatId}-${Date.now()}`;

  reminders[reminderId] = { chatId, message: task, time };

  await bot.sendMessage(chatId, `✅ Reminder saved for ${time}: ${task}`);

  // Calculate the delay in milliseconds
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();
  const reminderTime = new Date(now.setHours(hours, minutes, 0, 0));
  const delay = reminderTime.getTime() - Date.now();

  // Ensure the reminder is set for the next occurrence
  const reminderDelay = delay > 0 ? delay : delay + 24 * 60 * 60 * 1000;

  // Set the reminder to trigger at the specified time
  setTimeout(async () => {
    await bot.sendMessage(chatId, `⏰ Reminder: ${task}`);
    delete reminders[reminderId]; // Clean up the reminder after sending
  }, reminderDelay);

  return NextResponse.json({ ok: true });
}

