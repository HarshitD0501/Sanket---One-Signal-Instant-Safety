import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import CTA from '../components/landing/CTA';
import VoiceAssistantWidget from '../components/landing/VoiceAssistantWidget';

export default function Landing() {
  return (
    <>
      <div className="landing-hero-shell">
        <Navbar />
        <Hero />
      </div>
      <Features />
      <HowItWorks />
      <CTA />
      <VoiceAssistantWidget />
    </>
  );
}
