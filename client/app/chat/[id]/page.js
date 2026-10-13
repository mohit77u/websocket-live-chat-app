import ChatView from '@/components/chat/ChatView';

// Server wrapper: `instant` sirf server components mein export ho sakta hai.
// Conversation id ChatView khud useParams() se padhta hai (runtime data server pe nahi chahiye).
export const instant = false;

export default function ConversationPage() {
  return <ChatView />;
}
