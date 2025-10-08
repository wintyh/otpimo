// app/api/telegram/cron/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { redis } from "@/lib/redis";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) throw new Error("Missing TELEGRAM_TOKEN");

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

export async function GET() {
  if (!redis) return NextResponse.json({ ok: false, error: "No Redis" });

  const now = Date.now();

  // Fetch all reminders due up to now using lowercase zrange
  const due = await redis.zrange("tg:reminders", 0, now);
  if (!due.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;

  for (const member of due) {
    try {
      // Type assertion because Redis returns unknown[]
      const memberStr = member as string;
      const r = JSON.parse(memberStr) as {
        id: string;
        chatId: number;
        task: string;
        dueMs: number;
      };

      // Send reminder
      await bot.sendMessage(r.chatId, `⏰ Reminder: ${r.task}`);
      sent++;

      // Remove from the set so we don’t resend
      await redis.zrem("tg:reminders", memberStr);
    } catch (e) {
      console.error("Cron send error:", e);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
