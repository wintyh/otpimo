// app/api/telegram/decisions/route.ts
import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

const TELEGRAM_TOKEN = process.env.TOKEN_ID!;
const OPENAI_KEY = process.env.OPENAI_API_WORKSHOP_KEY!;

if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN (process.env.TOKEN_ID)");
}
if (!OPENAI_KEY) {
  throw new Error("Missing OPENAI_KEY (process.env.OPENAI_API_WORKSHOP_KEY)");
}

// Instantiate bot (without polling in serverless environment)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body.msg;
    const chatId = msg.chat.id as number;
    const text = msg.text as string;

    await bot.sendMessage(chatId, "🤔 Thinking about your decision...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a concise decision-making assistant. Provide clear, balanced advice (2–3 short paragraphs).",
        },
        { role: "user", content: text },
      ],
    });

    const advice = response.choices[0].message.content || "No advice available.";
    await bot.sendMessage(chatId, `🧠 Decision advice:\n\n${advice}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error in decisions route:", e);
    // If sending message fails, we still try to inform the user
    // but if bot.sendMessage fails, we swallow to avoid crash
    try {
      const body = await req.json();
      const chatId = body.msg.chat.id as number;
      await bot.sendMessage(chatId, "❌ Sorry, I couldn’t generate advice at the moment.");
    } catch (_) {
      // ignore
    }
    return NextResponse.json({ ok: false, error: "Internal error" });
  }
}
