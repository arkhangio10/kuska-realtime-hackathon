import type { Metadata } from "next";
import "./globals.css";
import "./gateway.css";
import "./animation.css";
import "./world.css";
import "./collision.css";
import "./globe.css";
import "./alerts.css";
import "./decision-room.css";
export const metadata: Metadata = { title: "KUSKA — Juntos resolvemos lo que importa", description: "Misión viva para reducir el impacto de inundaciones en Piura." };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html>; }
