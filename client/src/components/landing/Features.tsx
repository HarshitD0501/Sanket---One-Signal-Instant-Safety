import useScrollAnimation from '../../hooks/useScrollAnimation';
import { HiOutlineBell, HiOutlineDevicePhoneMobile, HiOutlineMapPin, HiOutlineChatBubbleLeftRight, HiOutlineMap, HiOutlineLink } from 'react-icons/hi2';

const features = [
  { icon: <HiOutlineBell size={24} />, title: 'One-Tap SOS', desc: 'Giant emergency button triggers instant alerts to all your trusted contacts within seconds.' },
  { icon: <HiOutlineChatBubbleLeftRight size={24} />, title: 'WhatsApp + Voice Alerts', desc: 'Bilingual emergency messages via WhatsApp Business API and automated Twilio voice calls.' },
  { icon: <HiOutlineMapPin size={24} />, title: 'Live GPS Tracking', desc: 'Real-time location sharing via Socket.IO with breadcrumb trail of your movement.' },
  { icon: <HiOutlineDevicePhoneMobile size={24} />, title: 'Shake to SOS', desc: 'Device shake detection — no need to unlock your phone or find the button in panic.' },
  { icon: <HiOutlineMap size={24} />, title: 'Safe Zones', desc: 'Nearby police stations and hospitals shown on map so you can find help fast.' },
  { icon: <HiOutlineLink size={24} />, title: 'Shareable Tracking', desc: 'Public tracking links — your contacts don\'t need to login to see your live location.' },
];

export default function Features() {
  const gridRef = useScrollAnimation({ animation: 'fade-up', children: true, stagger: 0.1 });

  return (
    <section className="features-section" id="features">
      <div className="section-badge">✦ Features</div>
      <h2 className="section-title">Everything You Need to Stay Safe</h2>
      <p className="section-subtitle">
        Built with cutting-edge technology to ensure your safety is never more than a tap away.
      </p>
      <div className="features-grid" ref={gridRef}>
        {features.map((f, i) => (
          <div key={i} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
