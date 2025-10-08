export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN in environment variables");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    const chatId = message?.chat?.id;
    const text = message?.text;

    if (!chatId || !text) {
      return NextResponse.json(
        { error: "Invalid request: chatId or text missing" },
        { status: 400 }
      );
    }

    // Extract reminder details (example: "remind me to buy milk at 6pm")
    const match = text.match(/remind me to (.+) at (\d{1,2}(?::\d{2})?\s?(am|pm)?)/i);
    let replyText = "";

    if (match) {
      const task = match[1];
      const time = match[2];
      replyText = `Got it! I’ll remind you to ${task} at ${time} ⏰`;

      // Optional: Here’s where you could store the reminder in a database or schedule it
      // e.g., await saveReminder(chatId, task, time);
    } else {
      replyText = "Please use the format: 'Remind me to [task] at [time]'";
    }

    // Send reply to Telegram
    await axios.post(TELEGRAM_API, {
      chat_id: chatId,
      text: replyText,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in /reminders:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
