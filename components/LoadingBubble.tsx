import React from "react";

const LoadingBubble = () => {
  return (
    <div className="max-w-[80%] px-4 py-2 rounded-lg bg-gray-700 text-gray-300 self-start">
      <div className="flex space-x-2 animate-bounce">
        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
      </div>
    </div>
  );
};

export default LoadingBubble;
