import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Telegram token environment variable
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("TELEGRAM_TOKEN is not defined");
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Helpers

async function telegramSendMessage(
  chat_id: number,
  text: string,
  opts?: Record<string, unknown>
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id,
    text,
    ...opts,
  };
  await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, payload);
}

async function telegramAnswerCallback(
  callback_query_id: string,
  text?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    callback_query_id,
  };
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
  const body = await req.json();

  // Handle button presses / callback queries
  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;

    // Acknowledge callback
    await telegramAnswerCallback(callbackId);

    switch (data) {
      case "reminder":
        await telegramSendMessage(
          chatId,
          "⏰ Send your reminder in this format:\n`HH:MM Task`",
          { parse_mode: "Markdown" }
        );
        break;
      case "notes":
        await telegramSendMessage(chatId, "📝 Send me a note (text or voice).");
        break;
      case "decisions":
        await telegramSendMessage(chatId, "⚖️ Describe your decision question:");
        break;
      default:
        await sendMainMenu(chatId);
        break;
    }

    return NextResponse.json({ ok: true });
  }

  // Handle messages
  if (body.message) {
    const msg = body.message;
    const chatId = msg.chat.id;

    if (msg.text?.startsWith("/start")) {
      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    // Reminder pattern “HH:MM Task”
    if (/^\d{2}:\d{2}\s+.+/.test(msg.text ?? "")) {
      // Forward to reminders module
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/reminders`,
        { msg }
      );
      return NextResponse.json({ ok: true });
    }

    // Decision question detection (contains “?”)
    if (msg.text && msg.text.includes("?")) {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/decisions`,
        { msg }
      );
      return NextResponse.json({ ok: true });
    }

    // Notes: text or voice
    if (msg.text || msg.voice) {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/notes`,
        { msg }
      );
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: true });
}
