import { getConfig, publicConfig } from "@/lib/store";
import Motion from "@/components/Motion";
import Booking from "@/components/Booking";
import {
  Preloader, Header, Ticker, Hero, Studio, Services, Team, Process, Notices, Visit, Reviews, Footer,
} from "@/components/Site";

// Siempre lee la config actual (lo que se edita en /admin se ve al instante).
export const dynamic = "force-dynamic";

export default async function Home() {
  const cfg = publicConfig(await getConfig());
  return (
    <>
      <Preloader />
      <Header cfg={cfg} />
      <main>
        <Hero cfg={cfg} />
        <Ticker cfg={cfg} />
        <Studio cfg={cfg} />
        <Services cfg={cfg} />
        <Team cfg={cfg} />
        <Process cfg={cfg} />
        <Booking cfg={cfg} />
        <Notices cfg={cfg} />
        <Visit cfg={cfg} />
        <Reviews cfg={cfg} />
      </main>
      <Footer cfg={cfg} />
      <Motion />
    </>
  );
}
