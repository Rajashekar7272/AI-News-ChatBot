"use client";
import LoadingBubble from "@/components/LoadingBubble";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import PromptSuggestion from "../components/PromptSuggestion";
import Logo from "../public/News.jpg";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  const submitMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const userMessage: Message = { role: "user", content: messageContent };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      // Add temporary assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantContent += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === "assistant") {
            lastMessage.content = assistantContent;
          }
          return newMessages;
        });

        scrollToBottom();
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, there was an error processing your request.",
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      scrollToBottom();
    }
  };

  const handleClearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    submitMessage(suggestion);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Link href="/">
          <Image src={Logo} alt="Logo" className="w-20 mb-4" />
        </Link>
        <Link href="/">
          <h2 className="font-bold text-2xl">AI-News Chat-Bot</h2>
        </Link>
        {messages.length === 0 && (
          <PromptSuggestion onPromptClick={handleSuggestionClick} />
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-3xl p-4 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "text-white bg-black border-gray-100 shadow-md"
              }`}
            >
              <p className="">{message.content}</p>
              {index === messages.length - 1 && isLoading && <LoadingBubble />}
            </div>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t bg-black">
        <div className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message and Get Your News......."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
}