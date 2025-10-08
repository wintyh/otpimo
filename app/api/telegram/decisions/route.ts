// decisions/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const OPENAI_KEY = process.env.OPENAI_API_WORKSHOP_KEY!;
if (!TELEGRAM_TOKEN || !OPENAI_KEY) {
  throw new Error("Missing TELEGRAM_TOKEN or OPENAI_API_WORKSHOP_KEY");
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Bad JSON in decisions route:", err);
    return NextResponse.json({ ok: false, error: "Bad JSON" });
  }

  const msg = body.msg;
  const chatId = msg.chat.id as number;
  const text = msg.text as string;

  try {
    await bot.sendMessage(chatId, "🤔 Thinking about your decision...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a decision-making assistant. Provide clear, balanced advice in 2–3 short paragraphs.",
        },
        { role: "user", content: text },
      ],
    });

    const advice = completion.choices[0].message.content ?? "No advice available.";
    await bot.sendMessage(chatId, `🧠 Decision advice:\n\n${advice}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error in decisions route:", e);
    try {
      await bot.sendMessage(chatId, "❌ Sorry, I couldn’t generate advice at the moment.");
    } catch (sendErr) {
      console.error("Failed error-message send:", sendErr);
    }
    return NextResponse.json({ ok: false, error: "Internal error" });
  }
}
