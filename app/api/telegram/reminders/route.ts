import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = process.env.TOKEN_ID!;
const bot = new TelegramBot(TELEGRAM_TOKEN);

// In-memory storage (temporary; replace with DB)
const reminders: Record<string, { chatId: number; message: string; time: string }> = {};

export async function POST(req: NextRequest) {
const { msg } = await req.json();
const chatId = msg.chat.id;
const text = msg.text as string;

const [time, ...taskParts] = text.split(" ");
const task = taskParts.join(" ");
const reminderId = `${chatId}-${Date.now()}`;

reminders[reminderId] = { chatId, message: task, time };

await bot.sendMessage(chatId, `✅ Reminder saved for ${time}: ${task}`);

// To simulate sending a reminder later (for demo only)
setTimeout(async () => {
await bot.sendMessage(chatId, `⏰ Reminder: ${task}`);
}, 10000); // 10 seconds later

return NextResponse.json({ ok: true });
}
