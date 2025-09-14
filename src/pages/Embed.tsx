import { ChatWidget } from "@/components/chat/ChatWidget";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Embed = () => {
  const { agentId } = useParams<{ agentId: string }>();

  useEffect(() => {
    const setFavicon = async () => {
      if (!agentId) return;
      try {
        const { data, error } = await supabase.functions.invoke("get-public-agent-config", {
          body: { agentId },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        if (data.avatar_url) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.avatar_url;
        }
      } catch (err) {
        console.error("Failed to set favicon for embed:", err);
      }
    };

    setFavicon();
  }, [agentId]);

  return (
    <div className="w-screen h-dvh bg-transparent">
      <ChatWidget />
    </div>
  );
};

export default Embed;