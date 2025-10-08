import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN (process.env.TELEGRAM_TOKEN)");
}

// Instantiate bot (without polling in serverless environment)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body.msg;
    const chatId = msg.chat.id as number;
    // Removed unused variable 'text'
    // const text = msg.text as string;

    await bot.sendMessage(chatId, "🤔 Thinking about your decision...");

    // Since OpenAI integration is removed, you can add your own decision-making logic here
    const advice = "No advice available."; // Placeholder for decision-making logic

    await bot.sendMessage(chatId, `🧠 Decision advice:\n\n${advice}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error in decisions route:", e);
    try {
      const body = await req.json();
      const chatId = body.msg.chat.id as number;
      await bot.sendMessage(chatId, "❌ Sorry, I couldn’t generate advice at the moment.");
    } catch {
      // ignore unused error param
    }
    return NextResponse.json({ ok: false, error: "Internal error" });
  }
}
