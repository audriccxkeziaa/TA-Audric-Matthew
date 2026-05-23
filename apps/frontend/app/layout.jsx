import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "POS — CV Asia Jaya Maju",
  description:
    "Sistem Point of Sale dengan OCR stok masuk dan Rule-Based System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
