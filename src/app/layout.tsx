import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "../styles.css";
import "../identity.css";

export const metadata: Metadata = {
  title: "SunSpot — Sun guides your decision",
  description:
    "Hitta soliga parker, barer och restauranger i Köpenhamn och planera en träff med vänner.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
