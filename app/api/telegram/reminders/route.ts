// app/api/telegram/reminders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { redis } from "@/lib/redis";
import { DateTime } from "luxon";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN");
}
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Optional: let you override timezone; default to your bot’s main audience
const USER_TZ = process.env.USER_TZ || "Asia/Singapore";

interface TelegramMessage {
  chat: { id: number };
  text: string;
}
interface TelegramRequestBody {
  msg: TelegramMessage;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: TelegramRequestBody;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Bad JSON in reminders route:", err);
    return NextResponse.json({ ok: false, error: "Bad JSON" });
  }

  const msg = body.msg;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  const m = text.match(/^(\d{2}):(\d{2})\s+(.+)/);
  if (!m) {
    await bot.sendMessage(
      chatId,
      "❌ Invalid format. Use <code>HH:MM Task</code>",
      { parse_mode: "HTML" }
    );
    return NextResponse.json({ ok: false });
  }

  const [, hh, mm, task] = m;
  const hours = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    await bot.sendMessage(chatId, "❌ Invalid time. Use 24h HH:MM.");
    return NextResponse.json({ ok: false });
  }

  // Compute next due timestamp in ms (persistable)
  const now = DateTime.now().setZone(USER_TZ);
  let due = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
  if (due <= now) due = due.plus({ days: 1 });
  const dueMs = due.toMillis();

  const reminderId = `r:${chatId}:${Date.now()}`;
  const member = JSON.stringify({ id: reminderId, chatId, task, dueMs });

  if (redis) {
    // Sorted set: score = dueMs
    await redis.zadd("tg:reminders", { score: dueMs, member });
  }

  await bot.sendMessage(
    chatId,
    `✅ Reminder saved for ${due.toFormat("HH:mm")}: ${task}`
  );

  return NextResponse.json({ ok: true });
}
