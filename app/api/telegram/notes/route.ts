// app/api/telegram/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TOKEN_ID!;
const ASSEMBLY_KEY = process.env.ASSEMBLY_AI!;
if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN (process.env.TOKEN_ID)");
}
if (!ASSEMBLY_KEY) {
  throw new Error("Missing ASSEMBLY_KEY (process.env.ASSEMBLY_AI)");
}

// Note: if using node-telegram-bot-api in a serverless / stateless environment, polling won’t work well
// Use { polling: false } or use HTTP API directly (depending on your setup)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Temporary in-memory notes store
const userNotes: Record<number, { text: string; timestamp: string; type: "voice" | "text" }[]> = {};

/**
 * Transcribe a voice file via AssemblyAI
 */
async function transcribeVoice(fileUrl: string): Promise<string | null> {
  try {
    const res = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: fileUrl,
        language_detection: true,
        punctuate: true,
      },
      {
        headers: {
          authorization: ASSEMBLY_KEY,
          "content-type": "application/json",
        },
      }
    );

    const id = res.data.id;
    // Poll for result
    for (let i = 0; i < 30; i++) {
      const poll = await axios.get(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          authorization: ASSEMBLY_KEY,
        },
      });
      const status = poll.data.status;
      if (status === "completed") {
        return poll.data.text;
      }
      if (status === "error") {
        return null;
      }
      // wait 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    // timed out
    return null;
  } catch (err) {
    console.error("Error in transcribeVoice:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { msg } = await req.json();
    const chatId = msg.chat.id;

    // Voice message handling
    if (msg.voice) {
      // Get file info from Telegram
      const fileInfo = await bot.getFile(msg.voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.file_path}`;

      await bot.sendMessage(chatId, "🎤 Transcribing your voice note...");
      const text = await transcribeVoice(fileUrl);

      if (text) {
        if (!userNotes[chatId]) {
          userNotes[chatId] = [];
        }
        userNotes[chatId].push({
          text,
          timestamp: new Date().toISOString(),
          type: "voice",
        });
        await bot.sendMessage(chatId, `📝 Voice note saved:\n${text}`);
      } else {
        await bot.sendMessage(chatId, "❌ Transcription failed. Please try again.");
      }

      return NextResponse.json({ ok: true });
    }

    // Text message handling
    if (msg.text) {
      if (!userNotes[chatId]) {
        userNotes[chatId] = [];
      }
      userNotes[chatId].push({
        text: msg.text,
        timestamp: new Date().toISOString(),
        type: "text",
      });

      await bot.sendMessage(chatId, `📝 Text note saved:\n${msg.text}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false });
  } catch (error) {
    console.error("Error in /notes route:", error);
    return NextResponse.json({ ok: false, error: "Internal error" });
  }
}
