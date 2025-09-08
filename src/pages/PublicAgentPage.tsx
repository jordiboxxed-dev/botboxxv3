import { PublicChatInterface } from "@/components/chat/PublicChatInterface";

const PublicAgentPage = () => {
  return (
    <div className="w-screen h-dvh bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[450px] h-full max-h-[700px]">
        <PublicChatInterface />
      </div>
    </div>
  );
};

export default PublicAgentPage;