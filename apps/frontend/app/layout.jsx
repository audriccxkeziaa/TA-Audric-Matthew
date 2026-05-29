import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "./providers";

// Tipografi profesional: Inter dimuat sebagai CSS variable (--font-sans)
// lalu dipakai oleh Tailwind via fontFamily.sans di tailwind.config.js.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "POS — CV Asia Jaya Maju",
  description:
    "Sistem Point of Sale dengan OCR stok masuk dan Rule-Based System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
