import EmptyChat from '@/components/chat/EmptyChat';

// Server wrapper: `instant` sirf server components mein export ho sakta hai
export const instant = false;

export default function ChatPage() {
  return <EmptyChat />;
}
