import React, { useEffect, useRef, useState } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  Maximize,
  Minimize
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';

interface ChatVideoCallProps {
  chatId: string;
  callId: string;
  currentUser: any;
  otherUser: User | null;
  onClose: () => void;
  isInitiator: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const ChatVideoCall: React.FC<ChatVideoCallProps> = ({ 
  chatId, 
  callId,
  currentUser, 
  otherUser, 
  onClose,
  isInitiator 
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const signalingUnsubscribe = useRef<() => void>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        await startSignaling(stream);
      } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Could not access camera or microphone.");
        onClose();
      }
    };

    init();

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (signalingUnsubscribe.current) signalingUnsubscribe.current();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
  };

  const startSignaling = async (stream: MediaStream) => {
    const q = query(
      collection(db, 'chats', chatId, 'signaling'),
      where('callId', '==', callId),
      where('from', '!=', currentUser.uid)
    );

    signalingUnsubscribe.current = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const signal = change.doc.data();
          
          if (signal.type === 'offer' && signal.to === currentUser.uid) {
            handleOffer(signal.from, JSON.parse(signal.data), stream);
          } else if (signal.type === 'answer' && signal.to === currentUser.uid) {
            handleAnswer(JSON.parse(signal.data));
          } else if (signal.type === 'candidate' && signal.to === currentUser.uid) {
            handleCandidate(JSON.parse(signal.data));
          } else if (signal.type === 'leave') {
            setStatus('ended');
            setTimeout(onClose, 2000);
          }
        }
      });
    });

    if (isInitiator) {
      await createOffer(stream);
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    pc.current = peer;

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setStatus('connected');
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && otherUser) {
        addDoc(collection(db, 'chats', chatId, 'signaling'), {
          type: 'candidate',
          from: currentUser.uid,
          to: otherUser.uid,
          callId,
          data: JSON.stringify(event.candidate),
          timestamp: serverTimestamp()
        });
      }
    };

    return peer;
  };

  const createOffer = async (stream: MediaStream) => {
    if (!otherUser) return;
    const peer = createPeerConnection(stream);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    await addDoc(collection(db, 'chats', chatId, 'signaling'), {
      type: 'offer',
      from: currentUser.uid,
      to: otherUser.uid,
      callId,
      data: JSON.stringify(offer),
      timestamp: serverTimestamp()
    });
  };

  const handleOffer = async (remoteUid: string, offer: RTCSessionDescriptionInit, stream: MediaStream) => {
    const peer = createPeerConnection(stream);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    await addDoc(collection(db, 'chats', chatId, 'signaling'), {
      type: 'answer',
      from: currentUser.uid,
      to: remoteUid,
      callId,
      data: JSON.stringify(answer),
      timestamp: serverTimestamp()
    });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (pc.current) {
      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleCandidate = async (candidate: RTCIceCandidateInit) => {
    if (pc.current) {
      await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const endCall = async () => {
    if (otherUser) {
      await addDoc(collection(db, 'chats', chatId, 'signaling'), {
        type: 'leave',
        from: currentUser.uid,
        to: otherUser.uid,
        callId,
        timestamp: serverTimestamp()
      });
    }
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`fixed inset-0 z-[100] bg-black flex flex-col ${isFullscreen ? '' : 'md:inset-auto md:right-8 md:bottom-8 md:w-96 md:h-[500px] md:rounded-3xl md:shadow-2xl md:border md:border-white/10 overflow-hidden'}`}
    >
      {/* Remote Video (Main) */}
      <div className="relative flex-1 bg-zinc-900">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            <img 
              src={otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherUser?.displayName}&background=random`} 
              className="w-24 h-24 rounded-full border-4 border-accent/30 animate-pulse"
            />
            <p className="text-white font-medium">
              {status === 'connecting' ? `Calling ${otherUser?.displayName}...` : 'Connecting...'}
            </p>
          </div>
        )}

        {/* Local Video (PIP) */}
        <div className="absolute top-4 right-4 w-24 h-36 md:w-32 md:h-48 bg-zinc-800 rounded-xl overflow-hidden border border-white/20 shadow-xl z-10">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
          />
          {isCameraOff && (
            <div className="w-full h-full flex items-center justify-center bg-zinc-700">
              <VideoOff size={24} className="text-white/50" />
            </div>
          )}
        </div>

        {/* Call Info Overlay */}
        <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            {status === 'connected' ? 'Live' : 'Connecting'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="h-24 bg-zinc-900/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-center space-x-6 px-6">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          onClick={toggleCamera}
          className={`p-4 rounded-2xl transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
        >
          {isCameraOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
        </button>

        <button
          onClick={endCall}
          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all shadow-lg shadow-red-900/20"
        >
          <PhoneOff size={24} />
        </button>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl transition-all"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </motion.div>
  );
};
