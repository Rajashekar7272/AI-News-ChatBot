import { DataAPIClient } from "@datastax/astra-db-ts";
import {
  Browser,
  PuppeteerGotoOptions,
  PuppeteerWebBaseLoader,
} from "langchain/document_loaders/web/puppeteer";
import { GoogleGenAI } from "@google/genai"; // Note: This might need to be "@google/generative-ai"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined");
}

if (!ASTRA_DB_API_ENDPOINT) {
  throw new Error("ASTRA_DB_API_ENDPOINT is not defined");
}

if (!ASTRA_DB_COLLECTION) {
  throw new Error("ASTRA_DB_COLLECTION is not defined");
}

// Instantiate Gemini AI client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const news = [
  "https://en.wikipedia.org/wiki/Portal:Current_events",
  "https://www.bbc.com/news/world",
  "https://www.ndtv.com/world-news",
  "https://indianexpress.com/section/world/",
  "https://edition.cnn.com/",
  "https://indianexpress.com/",
  "https://www.ndtv.com/",
  "https://www.indiatoday.in/",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

/**
 * Creates a collection in Astra DB if it doesn't already exist.
 * @param similarityMetric The similarity metric for vector search.
 */
const createCollection = async (
  similarityMetric: SimilarityMetric = "dot_product"
) => {
  try {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
      vector: {
        dimension: 768, // Correct dimension for "embedding-001"
        metric: similarityMetric,
      },
    });
    console.log("Collection created:", res);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      console.log("Collection already exists");
    } else {
      throw error;
    }
  }
};

/**
 * Loads sample data by scraping news websites, generating embeddings, and storing them.
 */
const loadSampledata = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION);
  for (const url of news) {
    try {
      console.log(`Scraping ${url}`);
      const content = await scrapePage(url);
      const chunks = await splitter.splitText(content);
      console.log(`Inserting ${chunks.length} chunks for ${url}`);
      for (const chunk of chunks) {
        try {
          // Request embedding from Gemini
          const embeddingRes = await ai.models.embedContent({
            model: "embedding-001", // Correct model name
            contents: chunk,
          });

          // Adjust based on actual response structure; assuming data[0].embedding
          const vector = embeddingRes.embeddings?.[0]?.values

          const res = await collection.insertOne({
            $vector: vector,
            text: chunk,
          });
          console.log("Inserted chunk:", res);
        } catch (error) {
          console.error(`Error processing chunk for ${url}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }
};

/**
 * Scrapes a webpage and extracts its text content.
 * @param url The URL to scrape.
 * @returns The text content of the page.
 */
async function scrapePage(url: string): Promise<string> {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" } as PuppeteerGotoOptions,
    evaluate: async (page, browser: Browser) => {
      const text = await page.evaluate(() => document.body.innerText);
      await browser.close();
      return text;
    },
  });
  const text = await loader.scrape();
  return text;
}

// Immediately invoked async function to run the script
(async () => {
  await createCollection();
  await loadSampledata();
})();