import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN");
}
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// In-memory reminders (will be lost between cold starts)
const reminders: Record<string, { chatId: number; message: string; time: string }> = {};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { msg } = await req.json();
  const chatId = msg.chat.id as number;
  const text = msg.text as string;

  const [time, ...taskParts] = text.split(" ");
  const task = taskParts.join(" ");
  const reminderId = `${chatId}-${Date.now()}`;

  reminders[reminderId] = { chatId, message: task, time };

  await bot.sendMessage(chatId, `✅ Reminder saved for ${time}: ${task}`);

  // Parse time
  const [hours, minutes] = time.split(":").map((n) => parseInt(n, 10));
  if (isNaN(hours) || isNaN(minutes)) {
    // invalid time format
    await bot.sendMessage(chatId, "❌ Invalid time format. Use HH:MM (24h).");
    return NextResponse.json({ ok: false });
  }

  // Compute the next occurrence
  const now = new Date();
  const reminderTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
  let delay = reminderTime.getTime() - Date.now();
  if (delay < 0) {
    // It's past that time today — schedule for next day
    delay += 24 * 60 * 60 * 1000;
  }

  // Caution: In serverless environment, this may not reliably run
  setTimeout(async () => {
    try {
      await bot.sendMessage(chatId, `⏰ Reminder: ${task}`);
    } catch (e) {
      console.error("Failed to send reminder:", e);
    }
    delete reminders[reminderId];
  }, delay);

  return NextResponse.json({ ok: true });
}
