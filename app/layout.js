import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";

export const metadata = {
  title: "Fortunato Barbería · Luján",
  description: "Barbería en el centro de Luján, Colón 1156. Reservá tu turno online eligiendo barbero, servicio y horario.",
  openGraph: {
    title: "Fortunato Barbería · Luján",
    description: "Reservá tu turno online. Colón 1156, a metros de la plaza Colón.",
    locale: "es_AR",
    type: "website",
  },
};

export const viewport = { themeColor: "#000000" };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
