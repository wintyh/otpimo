export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

// Ensure token is present
if (!TELEGRAM_TOKEN) {
  throw new Error("Missing TELEGRAM_TOKEN in environment variables");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    const chatId = message?.chat?.id;
    const text = message?.text;

    if (!chatId || !text) {
      return NextResponse.json(
        { error: "Invalid request: chatId or text missing" },
        { status: 400 }
      );
    }

    // Decision logic
    let replyText = "";
    if (text.toLowerCase().includes("yes")) {
      replyText = "Great! Let’s proceed with your decision ✅";
    } else if (text.toLowerCase().includes("no")) {
      replyText = "No worries! You can revisit this later 🙂";
    } else {
      replyText = "Please reply with 'Yes' or 'No' to continue.";
    }

    // Send reply to Telegram
    await axios.post(TELEGRAM_API, {
      chat_id: chatId,
      text: replyText,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in /decisions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
