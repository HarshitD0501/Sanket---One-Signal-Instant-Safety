import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Room, createLocalAudioTrack } from 'livekit-client';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineMicrophone,
  HiOutlinePaperAirplane,
  HiOutlineSpeakerWave,
  HiOutlineStopCircle,
  HiOutlineXMark,
} from 'react-icons/hi2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type AssistantRole = 'user' | 'assistant';
type AssistantMode = 'voice' | 'text';

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  text: string;
  mode: AssistantMode;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

const initialMessage: AssistantMessage = {
  id: 'intro',
  role: 'assistant',
  mode: 'text',
  text: 'I am here. Are you safe to speak, or should we use text?',
};

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createSpeechRecognition = (): SpeechRecognitionLike | null => {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;
  return new SpeechRecognition();
};

export default function VoiceAssistantWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([initialMessage]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('Tap to start voice help');
  const [livekitStatus, setLivekitStatus] = useState<'idle' | 'connecting' | 'connected' | 'offline'>('idle');
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<any>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      audioTrackRef.current?.stop?.();
      roomRef.current?.disconnect();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakAssistantReply = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setStatus('Assistant speaking');
    utterance.onend = () => setStatus('Ready');
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (text: string, mode: AssistantMode) => {
    const cleanText = text.trim();
    if (!cleanText || loading) return;

    const userMessage: AssistantMessage = {
      id: makeId(),
      role: 'user',
      text: cleanText,
      mode,
    };
    const history = messages.map((message) => ({
      role: message.role,
      text: message.text,
    }));

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setLoading(true);
    setStatus('Thinking...');

    try {
      const response = await api.post('/assistant/chat', {
        message: cleanText,
        history,
      });
      const reply = response.data.data.reply;
      setMessages((current) => [
        ...current,
        { id: makeId(), role: 'assistant', text: reply, mode },
      ]);
      speakAssistantReply(reply);
    } catch (error: any) {
      let fallback =
        error.response?.data?.message ||
        'I cannot reach the assistant right now. If you are in immediate danger, call emergency services. In India, dial 112.';
      if (error.response?.status === 401) {
        fallback = 'Your session has expired. Please sign in again to continue.';
        setStatus('Session expired');
      }
      setMessages((current) => [
        ...current,
        { id: makeId(), role: 'assistant', text: fallback, mode: 'text' },
      ]);
      speakAssistantReply(fallback);
    } finally {
      setLoading(false);
      setStatus('Ready');
    }
  };

  const startListening = () => {
    const recognition = createSpeechRecognition();
    if (!recognition) {
      setStatus('Voice input not supported in this browser. Use text.');
      return;
    }

    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) sendMessage(transcript, 'voice');
    };
    recognition.onerror = () => {
      setListening(false);
      setStatus('Could not hear clearly. Try text or tap mic again.');
    };
    recognition.onend = () => {
      setListening(false);
      if (!loading) setStatus('Ready');
    };

    recognitionRef.current = recognition;
    window.speechSynthesis?.cancel();
    setListening(true);
    setStatus('Listening...');
    try {
      recognition.start();
    } catch {
      setListening(false);
      setStatus('Microphone unavailable. Use text.');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus('Ready');
  };

  const connectLiveKit = async () => {
    if (roomRef.current || livekitStatus === 'connecting') return;

    setLivekitStatus('connecting');
    try {
      const response = await api.post('/livekit/token');
      const { url, token } = response.data.data;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      await room.connect(url, token);
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      await room.localParticipant.publishTrack(track);
      roomRef.current = room;
      audioTrackRef.current = track;
      setLivekitStatus('connected');
    } catch {
      // LiveKit is optional; graceful fallback to browser speech assistant
      setLivekitStatus('offline');
    }
  };

  const openAssistant = async () => {
    setOpen(true);
    if (!user) {
      setStatus('Sign in required');
      return;
    }
    setStatus('Starting voice help');
    await connectLiveKit();
  };

  const closeAssistant = () => {
    setOpen(false);
    stopListening();
    window.speechSynthesis?.cancel();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage(draft, 'text');
  };

  return (
    <div className={`assistant-widget ${open ? 'open' : ''}`}>
      {open && (
        <section className="assistant-panel glass" aria-label="Sanket AI assistant">
          <div className="assistant-header">
            <div className="assistant-title">
              <span className="assistant-avatar">
                <HiOutlineSpeakerWave size={18} />
              </span>
              <div>
                <strong>Sanket Assistant</strong>
                <span>{status}</span>
              </div>
            </div>
            <button className="assistant-icon-btn" type="button" onClick={closeAssistant} aria-label="Close assistant">
              <HiOutlineXMark size={20} />
            </button>
          </div>

          {!user ? (
            <div
              className="assistant-auth-gate"
              style={{
                padding: '2rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <div
                className="assistant-avatar"
                style={{ width: '56px', height: '56px', margin: '0 auto', fontSize: '1.5rem' }}
              >
                <HiOutlineSpeakerWave size={28} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 600 }}>
                  Sign in for AI Safety Support
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary, #64748b)',
                    maxWidth: '280px',
                    lineHeight: 1.5,
                  }}
                >
                  Access your personalized crisis assistant, speech input, and hands-free voice companion.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  width: '100%',
                  maxWidth: '240px',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    width: '100%',
                    padding: '0.7rem 1rem',
                    borderRadius: '10px',
                    background: 'var(--accent, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  style={{
                    width: '100%',
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    background: 'transparent',
                    border: '1px solid var(--border, #cbd5e1)',
                    color: 'var(--text-primary, #1e293b)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Create an Account
                </button>
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '0.78rem',
                  color: '#b91c1c',
                  maxWidth: '300px',
                  lineHeight: 1.4,
                }}
              >
                <strong>Immediate Danger?</strong> If you are in crisis, please call emergency services directly at{' '}
                <strong>112</strong>.
              </div>
            </div>
          ) : (
            <>
              <div className="assistant-livekit-row">
                <span className={`assistant-livekit-dot ${livekitStatus}`} />
                {livekitStatus === 'connected'
                  ? 'LiveKit audio stream connected'
                  : livekitStatus === 'connecting'
                  ? 'Connecting to LiveKit...'
                  : 'Browser speech mode (LiveKit offline)'}
              </div>

              <div className="assistant-messages">
                {messages.map((message) => (
                  <div key={message.id} className={`assistant-message ${message.role}`}>
                    {message.text}
                  </div>
                ))}
                {loading && <div className="assistant-message assistant">Thinking...</div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="assistant-controls">
                <button
                  className={`assistant-mic-btn ${listening ? 'listening' : ''}`}
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? 'Stop listening' : 'Start voice input'}
                >
                  {listening ? <HiOutlineStopCircle size={22} /> : <HiOutlineMicrophone size={22} />}
                </button>
                <form className="assistant-form" onSubmit={handleSubmit}>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type if you cannot speak"
                    aria-label="Assistant message"
                  />
                  <button type="submit" aria-label="Send message" disabled={!draft.trim() || loading}>
                    <HiOutlinePaperAirplane size={18} />
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      )}

      {!open && (
        <button className="assistant-fab" type="button" onClick={openAssistant} aria-label="Open voice assistant">
          <HiOutlineChatBubbleLeftRight size={28} />
        </button>
      )}
    </div>
  );
}
