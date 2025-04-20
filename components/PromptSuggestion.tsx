import PromptSuggestionButton from "./PromptSuggestionButton";

const suggestions = [
  "Breaking news today",
  "What's the latest news in technology?",
  "Give me today's top headlines.",
  "Show me world news updates.",
  "What's happening in sports right now?",
  "Tell me the latest entertainment news.",
  "Any updates on the stock market?",
];

interface PromptSuggestionProps {
  onPromptClick: (suggestion: string) => void;
}

const PromptSuggestion = ({ onPromptClick }: PromptSuggestionProps) => {
  return (
    <div className="mt-4 flex flex-wrap gap-2 justify-center">
      {suggestions.map((suggestion, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={suggestion}
          onClick={() => onPromptClick(suggestion)}
        />
      ))}
    </div>
  );
};

export default PromptSuggestion;
