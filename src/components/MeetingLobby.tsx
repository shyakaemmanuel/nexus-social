import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface MeetingLobbyProps {
  meetingId: string;
  onJoin: (stream: MediaStream) => void;
}

export const MeetingLobby: React.FC<MeetingLobbyProps> = ({ meetingId, onJoin }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsLoading(false);
      } catch (error) {
        alert('Could not access camera or microphone. Please check permissions.');
        navigate('/meetings');
      }
    };

    init();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

  const handleJoin = () => {
    if (localStream) {
      setIsJoining(true);
      onJoin(localStream);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 z-[100]">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-3">Ready to join?</h1>
          <p className="text-zinc-400 text-lg">Check your audio and video before joining the meeting</p>
        </div>

        {/* Video Preview */}
        <div className="relative rounded-3xl overflow-hidden bg-zinc-900 aspect-video mb-8 border border-white/10 shadow-2xl">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={48} className="text-zinc-600 animate-spin" />
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
            />
          )}
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
              <div className="w-32 h-32 rounded-full bg-zinc-700 flex items-center justify-center text-5xl font-bold text-zinc-400">
                {user?.displayName?.[0]}
              </div>
            </div>
          )}

          {/* Meeting Info Overlay */}
          <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <p className="text-white text-sm font-medium">Meeting ID: {meetingId?.slice(0, 8)}</p>
          </div>

          {/* User Info Overlay */}
          <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <p className="text-white text-sm font-medium">{user?.displayName}</p>
          </div>

          {/* Status Indicators */}
          <div className="absolute bottom-6 right-6 flex items-center space-x-2">
            {isMuted && (
              <div className="bg-red-500/80 backdrop-blur-md p-2 rounded-full border border-red-500/50">
                <MicOff size={20} className="text-white" />
              </div>
            )}
            {isCameraOff && (
              <div className="bg-red-500/80 backdrop-blur-md p-2 rounded-full border border-red-500/50">
                <VideoOff size={20} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-6">
          <button
            onClick={toggleMute}
            className={`p-6 rounded-2xl transition-all shadow-xl ${
              isMuted ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </button>

          <button
            onClick={toggleCamera}
            className={`p-6 rounded-2xl transition-all shadow-xl ${
              isCameraOff ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            {isCameraOff ? <VideoOff size={28} /> : <VideoIcon size={28} />}
          </button>

          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="px-12 py-6 bg-accent hover:bg-accent/90 text-white rounded-2xl font-bold text-lg transition-all shadow-2xl shadow-accent/20 flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>Joining...</span>
              </>
            ) : (
              <>
                <Phone size={24} />
                <span>Join Meeting</span>
                <ArrowRight size={24} />
              </>
            )}
          </button>
        </div>

        {/* Cancel Button */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/meetings')}
            className="text-zinc-500 hover:text-white transition-colors text-sm font-medium"
          >
            Cancel and go back
          </button>
        </div>
      </div>
    </div>
  );
};
