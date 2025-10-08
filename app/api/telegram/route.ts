// /app/api/telegram/webhook/route.ts   (or wherever your route is)
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("TELEGRAM_TOKEN is not defined");
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Helper: send a message via Telegram Bot API
async function telegramSendMessage(
  chat_id: number,
  text: string,
  opts?: { [key: string]: any }
) {
  const payload: any = {
    chat_id,
    text,
    ...opts,
  };
  await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, payload);
}

// Helper: answer callback query (so Telegram UI stops “loading” on button press)
async function telegramAnswerCallback(
  callback_query_id: string,
  text?: string
) {
  const payload: any = {
    callback_query_id,
  };
  if (text) payload.text = text;
  await axios.post(`${TELEGRAM_API_BASE}/answerCallbackQuery`, payload);
}

// Sends the main menu with inline keyboard
async function sendMainMenu(chatId: number) {
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

export async function POST(req: NextRequest) {
  const body = await req.json();

  // If it’s a callback query (button press)
  if (body.callback_query) {
    const chatId = body.callback_query.message.chat.id;
    const data = body.callback_query.data;
    const callbackId = body.callback_query.id;

    // Optionally, answer the callback to remove loading UI
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
    }

    return NextResponse.json({ ok: true });
  }

  // If it's a message (text or voice, etc.)
  if (body.message) {
    const msg = body.message;
    const chatId = msg.chat.id;

    // /start command
    if (msg.text?.startsWith("/start")) {
      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    // Detect reminders like "HH:MM Task"
    if (/^\d{2}:\d{2}\s+.+/.test(msg.text ?? "")) {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/reminders`,
        { msg }
      );
      return NextResponse.json({ ok: true });
    }

    // Detect decisions (a question mark)
    if (msg.text && msg.text.includes("?")) {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/decisions`,
        { msg }
      );
      return NextResponse.json({ ok: true });
    }

    // Everything else, treat as notes
    if (msg.text || msg.voice) {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/notes`,
        { msg }
      );
      return NextResponse.json({ ok: true });
    }
  }

  // Fallback response
  return NextResponse.json({ ok: true });
}
