export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("TELEGRAM_TOKEN is not defined");
}
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
}

interface CallbackQuery {
  id: string;
  data: string;
  message: { chat: { id: number } };
}

interface TelegramRequestBody {
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
}

async function telegramSendMessage(
  chat_id: number,
  text: string,
  opts?: { parse_mode?: string; reply_markup?: unknown }
): Promise<void> {
  const payload = { chat_id, text, ...opts };
  await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, payload);
}

async function telegramAnswerCallback(callback_query_id: string, text?: string): Promise<void> {
  const payload: Record<string, unknown> = { callback_query_id };
  if (text) payload.text = text;
  await axios.post(`${TELEGRAM_API_BASE}/answerCallbackQuery`, payload);
}

async function sendMainMenu(chatId: number): Promise<void> {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Reminders", callback_data: "reminder" }],
        [{ text: "Notes", callback_data: "notes" }],
        [{ text: "Decisions", callback_data: "decisions" }],
      ],
    },
  };
  await telegramSendMessage(chatId, "Hi! I'm Optimo 🤖. Choose a mode:", opts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log("Telegram webhook invoked at path:", req.nextUrl.pathname, "URL:", req.url);
  console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers)));

  let body: TelegramRequestBody;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Failed to parse JSON body:", err);
    return NextResponse.json({ ok: false, error: "Bad JSON" });
  }

  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;

    await telegramAnswerCallback(callbackId);

    if (data === "reminder") {
      await telegramSendMessage(
        chatId,
        "⏰ Send your reminder in this format:\n`HH:MM Task`",
        { parse_mode: "Markdown" }
      );
    } else if (data === "notes") {
      await telegramSendMessage(chatId, "📝 Send me a note (text or voice).");
    } else if (data === "decisions") {
      await telegramSendMessage(chatId, "⚖️ Describe your decision question:");
    } else {
      await sendMainMenu(chatId);
    }

    return NextResponse.json({ ok: true });
  }

  if (body.message) {
    const msg = body.message;
    const chatId = msg.chat.id;
    const txt = msg.text?.trim();

    if (txt && txt.toLowerCase() === "/start") {
      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    if (/^\d{2}:\d{2}\s+.+/.test(txt ?? "")) {
      await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/reminders`, { msg });
      return NextResponse.json({ ok: true });
    }

    if (txt && txt.includes("?")) {
      await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/decisions`, { msg });
      return NextResponse.json({ ok: true });
    }

    if (msg.text || msg.voice) {
      await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/notes`, { msg });
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: true });
}
