export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { DateTime } from "luxon";

// Example in-memory reminder store (replace with Redis/DB in production)
const reminders: {
  chatId: number;
  task: string;
  time: string;
  notified?: boolean;
}[] = [];

// Telegram API setup
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN in environment variables");
}

export async function POST(req: NextRequest) {
  try {
    const now = DateTime.now().setZone("Asia/Singapore");

    // Filter reminders that are due
    const dueReminders = reminders.filter((r) => {
      if (r.notified) return false;
      const reminderTime = DateTime.fromFormat(r.time, "h:mm a", {
        zone: "Asia/Singapore",
      });
      return reminderTime <= now;
    });

    // Send due reminders
    for (const reminder of dueReminders) {
      await axios.post(TELEGRAM_API, {
        chat_id: reminder.chatId,
        text: `⏰ Reminder: ${reminder.task}`,
      });
      reminder.notified = true;
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${dueReminders.length} due reminders.`,
    });
  } catch (error) {
    console.error("Error in /cron:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
