import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Pulse Chat",
  description: "Real-time chat with rooms and direct messages",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: next-themes <html> pe class lagata hai
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
