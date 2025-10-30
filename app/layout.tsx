export const metadata = { title: "Approvazione Post", description: "CNVVF - approvazione contenuti" };
import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
