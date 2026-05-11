import { FormEvent, useEffect, useRef, useState } from 'react';
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
    setStatus('Thinking');

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
      const fallback =
        error.response?.data?.message ||
        'I cannot reach the assistant right now. If you are in immediate danger, call emergency services. In India, dial 112.';
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
      setStatus('Voice input not supported here. Use text.');
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
    setStatus('Listening');
    recognition.start();
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
      setLivekitStatus('offline');
    }
  };

  const openAssistant = async () => {
    setOpen(true);
    setStatus('Starting voice help');
    await connectLiveKit();
    startListening();
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

          <div className="assistant-livekit-row">
            <span className={`assistant-livekit-dot ${livekitStatus}`} />
            LiveKit {livekitStatus === 'connected' ? 'voice room connected' : livekitStatus}
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
