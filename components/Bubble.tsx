import React from 'react';

// Define a strict Message type instead of using `any`
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Props for the Bubble component
interface BubbleProps {
  message: Message;
  isLatest: boolean;
}

// Functional component with explicit types
const Bubble: React.FC<BubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] px-4 py-2 rounded-lg ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
};

export default Bubble;
