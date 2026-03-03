import type {Metadata} from 'next';
import { Quicksand } from 'next/font/google';
import './globals.css';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-quicksand',
});

export const metadata: Metadata = {
  title: 'PaperKnife - Your PDF Protector',
  description: 'Secure, browser-based PDF tools with zero uploads.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body suppressHydrationWarning className="font-sans">
        {children}
      </body>
    </html>
  );
}
