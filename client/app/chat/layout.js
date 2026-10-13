import { RequireAuth } from '@/components/AuthGate';
import ChatShell from '@/components/chat/ChatShell';

// /chat poora client-side auth ke peeche hai (token localStorage mein), to server pe static shell
// nahi ban sakta. Next ki "instant navigation" validation yahan intentionally band hai.
export const instant = false;

export default function ChatLayout({ children }) {
  return (
    <RequireAuth>
      <ChatShell>{children}</ChatShell>
    </RequireAuth>
  );
}
