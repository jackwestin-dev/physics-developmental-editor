import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physics Textbook Developmental Editor",
  description: "Transform physics content into textbook excerpts that match your pedagogy and style.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="header-inner">
            <div className="logo">JW</div>
            <nav className="nav">
              <a href="/">Flow</a>
              <a href="/editor">Editor</a>
              <a href="/gap">Gap (legacy)</a>
            </nav>
          </div>
        </header>
        <div className="gradient-deco" aria-hidden />
        <div className="main-wrap">{children}</div>
      </body>
    </html>
  );
}
