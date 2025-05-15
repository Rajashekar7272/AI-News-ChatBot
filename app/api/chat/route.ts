import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenAI } from "@google/genai";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

// Validate environment variables
if (
  !ASTRA_DB_API_ENDPOINT ||
  !ASTRA_DB_NAMESPACE ||
  !ASTRA_DB_APPLICATION_TOKEN ||
  !GEMINI_API_KEY ||
  !ASTRA_DB_COLLECTION
) {
  throw new Error(
    "Missing required environment variables. Check: " +
      "ASTRA_DB_API_ENDPOINT, ASTRA_DB_NAMESPACE, ASTRA_DB_APPLICATION_TOKEN, " +
      "GEMINI_API_KEY, and ASTRA_DB_COLLECTION"
  );
}

// Initialize clients
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });
const collection = db.collection(ASTRA_DB_COLLECTION);

export async function POST(request: Request) {
  try {
    // Parse incoming messages
    const { messages } = await request.json();
    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract latest message content
    const latestMessage = messages[messages.length - 1];
    const latestMessageContent = latestMessage?.content?.trim() || "";
    if (!latestMessageContent) {
      return new Response(
        JSON.stringify({ error: "No valid message content found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate embedding using Gemini
    const embeddingResponse = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [latestMessageContent],
    });

    const vector = embeddingResponse.embeddings?.[0]?.values;
    console.log("Generated vector length:", vector?.length);
    console.log("Sample vector:", vector?.slice(0, 5));

    if (!vector || vector.length !== 768) {
      console.error("Invalid embedding vector:", vector?.length);
      return new Response(
        JSON.stringify({ error: "Failed to generate valid embedding" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Vector search in Astra DB
    console.log("Running vector search...");
    const cursor = await collection.find(
      {},
      { sort: { $vector: vector }, limit: 10 }
    );
    const docs = await cursor.toArray();
    // console.log("Found documents count:", docs.length);
    // console.log("Documents text fields:", docs.map(doc => doc.text));

    const contextTexts = docs
      .map((doc) => doc.text?.trim())
      .filter(Boolean)
      .join("\n");

    if (!contextTexts) {
      console.warn("No context texts found from DB!");
    }

    // Construct enhanced prompt
    const systemPrompt = `You are a helpful AI assistant. Use this context to answer questions and provide General question and answers.

You are an AI-powered news chatbot. Your job is to provide **daily news updates** in a clean, organized way. News like sports, politics, technology, and entertainment.
You will receive a prompt asking for news updates. Your task is to summarize the latest news articles and present them in a clear format.

➡️ Format:
- Respond in **bullet points** only.
- Group news by sections: 🌍 World News, 🇮🇳 India News, 🏙️ Local News (if applicable), ⚽ Sports News, 🎥 Movies and Film News, 🔬 Science and Technology News, 📊 Stock News.
- Each bullet should be a **short headline or summary** (1–10 sentences max)
Also Give General information about all questions.

❌ Do not:
- Include images or image links
- Mention or promote apps or advertisements
- Add share buttons, links, or anything irrelevant
------------------------
${contextTexts}
------------------------
Current conversation history: ${JSON.stringify(messages.slice(0, -1))}
Question: ${latestMessageContent}`;

    // console.log("Constructed system prompt:", systemPrompt);

    // Generate streaming response
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
      ],
    });

    // Stream response using ReadableStream
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
            // console.log("Streamed chunk:", text);
            controller.enqueue(text);
          }
        } catch (error) {
          console.error("Error during stream:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
