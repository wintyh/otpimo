import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN in environment variables");
}

// Extend globalThis with a typed property
declare global {
  // eslint-disable-next-line no-var
  var _telegramBot: TelegramBot | undefined;
}

// Singleton pattern — ensures only one bot instance is created
const bot: TelegramBot = globalThis._telegramBot ?? new TelegramBot(TELEGRAM_TOKEN, { polling: false });
globalThis._telegramBot = bot;

// Helper to safely send messages
export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: TelegramBot.SendMessageOptions
) {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

export { bot };
