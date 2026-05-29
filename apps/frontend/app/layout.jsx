import "./globals.css";
import { GeistSans} from "geist/font/sans";
import Providers from "./providers";

// // Tipografi profesional: Inter dimuat sebagai CSS variable (--font-sans)
// // lalu dipakai oleh Tailwind via fontFamily.sans di tailwind.config.js.
// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-sans",
//   display: "swap",
// });

export const metadata = {
  title: "POS — CV Asia Jaya Maju",
  description:
    "Sistem Point of Sale dengan OCR stok masuk dan Rule-Based System",
};

// Pengaturan layar resmi (Next.js App Router). viewportFit="cover" + safe-area
// di globals.css membuat tampilan rapi di iPhone dengan poni/notch. maximumScale=5
// tetap mengizinkan pengguna zoom (aksesibilitas), tanpa zoom paksa saat fokus input.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#3730a3",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={GeistSans.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
