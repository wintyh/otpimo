export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const ASSEMBLY_KEY = process.env.ASSEMBLY_AI!;
if (!TELEGRAM_TOKEN || !ASSEMBLY_KEY) {
  throw new Error("Missing TELEGRAM_TOKEN or ASSEMBLY_AI");
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

interface Note {
  text: string;
  timestamp: string;
  type: "voice" | "text";
}

const userNotes: Record<number, Note[]> = {};

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
}

interface TelegramRequestBody {
  msg: TelegramMessage;
}

async function transcribeVoice(fileUrl: string): Promise<string | null> {
  try {
    const { data } = await axios.post(
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

    const id = data.id;
    for (let i = 0; i < 30; i++) {
      const { data: pollData } = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        {
          headers: { authorization: ASSEMBLY_KEY },
        }
      );
      if (pollData.status === "completed") {
        return pollData.text;
      }
      if (pollData.status === "error") {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return null;
  } catch (err) {
    console.error("Error in transcribeVoice:", err);
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: TelegramRequestBody;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Bad JSON in notes route:", err);
    return NextResponse.json({ ok: false, error: "Bad JSON" });
  }

  const msg = body.msg;
  const chatId = msg.chat.id;

  try {
    if (msg.voice) {
      const fileInfo = await bot.getFile(msg.voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.file_path}`;

      await bot.sendMessage(chatId, "🎤 Transcribing your voice note...");
      const text = await transcribeVoice(fileUrl);
      if (text) {
        userNotes[chatId] ??= [];
        userNotes[chatId].push({
          text,
          timestamp: new Date().toISOString(),
          type: "voice",
        });
        await bot.sendMessage(chatId, `📝 Voice note saved:\n${text}`);
      } else {
        await bot.sendMessage(chatId, "❌ Transcription failed. Please try again.");
      }
    } else if (msg.text) {
      userNotes[chatId] ??= [];
      userNotes[chatId].push({
        text: msg.text,
        timestamp: new Date().toISOString(),
        type: "text",
      });
      await bot.sendMessage(chatId, `📝 Text note saved:\n${msg.text}`);
    } else {
      await bot.sendMessage(chatId, "❌ No valid message received.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error in notes route:", err);
    return NextResponse.json({ ok: false, error: "Internal error" });
  }
}
