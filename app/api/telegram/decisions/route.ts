import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TOKEN_ID!;
const OPENAI_KEY = process.env.OPENAI_API_WORKSHOP_KEY!;
const ASSEMBLY_KEY = process.env.ASSEMBLY_AI!;

if (!TELEGRAM_TOKEN || !OPENAI_KEY || !ASSEMBLY_KEY) {
  throw new Error('Missing required environment variables');
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
}

async function transcribeVoice(fileUrl: string): Promise<string | null> {
  try {
    const res = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: fileUrl, language_detection: true, punctuate: true },
      { headers: { authorization: ASSEMBLY_KEY, 'content-type': 'application/json' } }
    );

    const id = res.data.id;
    for (let i = 0; i < 30; i++) {
      const poll = await axios.get(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: ASSEMBLY_KEY }
      });
      if (poll.data.status === 'completed') {
        return poll.data.text;
      }
      if (poll.data.status === 'error') {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    return null;
  } catch (err) {
    console.error('Error in transcribeVoice:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body.msg as TelegramMessage;
    const chatId = msg.chat.id;

    if (msg.voice) {
      const fileInfo = await bot.getFile(msg.voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfo.file_path}`;
      await bot.sendMessage(chatId, '🎤 Transcribing your voice note...');
      const text = await transcribeVoice(fileUrl);
      if (text) {
        await bot.sendMessage(chatId, `📝 Voice note saved:\n${text}`);
      } else {
        await bot.sendMessage(chatId, '❌ Transcription failed. Please try again.');
      }
    } else if (msg.text) {
      await bot.sendMessage(chatId, `📝 Text note saved:\n${msg.text}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in /notes route:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' });
  }
}
