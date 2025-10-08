export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!; // e.g. https://your-vercel-app.vercel.app

if (!TELEGRAM_TOKEN || !BASE_URL) {
  throw new Error("Missing TELEGRAM_TOKEN or NEXT_PUBLIC_BASE_URL");
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Define routes for your bot commands
const COMMANDS = [
  { command: "/start", description: "Start the bot" },
  { command: "/notes", description: "Save or retrieve notes" },
  { command: "/decide", description: "Make a random decision" },
  { command: "/remind", description: "Set reminders" },
];

bot.setMyCommands(COMMANDS);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body.message;
    if (!msg || !msg.chat) {
      return NextResponse.json({ ok: false, error: "Invalid message body" });
    }

    const chatId = msg.chat.id;
    const text = msg.text || "";

    if (text.startsWith("/start")) {
      await bot.sendMessage(
        chatId,
        "👋 Welcome to Optimo Bot!\nYou can use the following commands:\n" +
          COMMANDS.map((c) => `${c.command} — ${c.description}`).join("\n")
      );
    } else if (text.startsWith("/notes")) {
      await axios.post(`${BASE_URL}/api/telegram/notes`, { msg });
    } else if (text.startsWith("/decide")) {
      await axios.post(`${BASE_URL}/api/telegram/decisions`, { msg });
    } else if (text.startsWith("/remind")) {
      await axios.post(`${BASE_URL}/api/telegram/reminders`, { msg });
    } else {
      await bot.sendMessage(
        chatId,
        "🤖 Sorry, I didn’t understand that. Try /notes, /decide, or /remind."
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: false, error: "Internal Server Error" });
  }
}
