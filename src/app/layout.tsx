import { AccountProvider } from "../Account.jsx";
import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "../styles.css";

export const metadata: Metadata = {
  title: "SunSpot — Good company. One link away.",
  description:
    "Hitta en plats i Köpenhamn, dela ett häng och låt vänner komma förbi. Med eller utan sol.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
