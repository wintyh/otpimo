// reminders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN");
}
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const reminders: Record<
  string,
  { chatId: number; message: string; time: string }
> = {};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Bad JSON in reminders route:", err);
    return NextResponse.json({ ok: false, error: "Bad JSON" });
  }

  const msg = body.msg;
  const chatId = msg.chat.id as number;
  const text = msg.text as string;

  const parts = text.split(" ");
  if (parts.length < 2) {
    await bot.sendMessage(chatId, "❌ Invalid format. Use `HH:MM Task`");
    return NextResponse.json({ ok: false });
  }
  const time = parts[0];
  const task = parts.slice(1).join(" ");
  const reminderId = `${chatId}-${Date.now()}`;

  reminders[reminderId] = { chatId, message: task, time };

  await bot.sendMessage(chatId, `✅ Reminder saved for ${time}: ${task}`);

  const [hours, minutes] = time.split(":").map((n) => parseInt(n, 10));
  if (isNaN(hours) || isNaN(minutes)) {
    await bot.sendMessage(chatId, "❌ Invalid time format. Use HH:MM (24h).");
    return NextResponse.json({ ok: false });
  }

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
    delay += 24 * 60 * 60 * 1000;
  }

  // WARNING: This timeout may not survive serverless function lifecycle.
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
