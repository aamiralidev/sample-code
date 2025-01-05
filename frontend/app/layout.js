import localFont from "next/font/local";
import "./globals.css";
import { Inter } from 'next/font/google'


const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const inter = Inter({ subsets: ['latin'] })
// added a comment

import { AuthProvider } from "../components/AuthContext";

export const metadata = {
  title: "Chat",
  description: "Created with Next.js",
};

export default function RootLayout({ children }) {

  return (
    <html lang="en">
      <head>
        <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <AuthProvider>
        <body
          className={`${inter.className} antialiased`}
        >
          {children}
        </body>
      </AuthProvider>
    </html>
  );
}
