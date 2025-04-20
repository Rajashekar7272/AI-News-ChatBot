interface PromptSuggestionButtonProps {
  text: string;
  onClick: () => void;
}

const PromptSuggestionButton = ({ text, onClick }: PromptSuggestionButtonProps) => {
    return (
      <button
        onClick={onClick}
        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
      >
        {text}
      </button>
    );
  };
  
  export default PromptSuggestionButton;
  