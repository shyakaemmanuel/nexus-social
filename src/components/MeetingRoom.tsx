import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff, 
  Monitor, 
  MonitorOff,
  Users,
  MessageSquare,
  Copy,
  Settings,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Meeting, MeetingParticipant } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  getMeeting, 
  listenToMeeting, 
  listenToParticipants, 
  joinMeeting, 
  leaveMeeting, 
  endMeeting,
  updateParticipantState
} from '../lib/meetings';
import { 
  createPeerConnection,
  getUserMedia,
  toggleAudioTrack,
  toggleVideoTrack,
  stopMediaStream,
  handleIceCandidate,
  addIceCandidate,
  createOffer,
  createAnswer,
  sendSignalingData,
  listenToSignalingData,
  isWebRTCSupported
} from '../lib/webrtc';

export const MeetingRoom: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());

  useEffect(() => {
    if (!meetingId || !user) return;

    // Check WebRTC support
    if (!isWebRTCSupported()) {
      setError('Your browser does not support WebRTC. Please use a modern browser.');
      setLoading(false);
      return;
    }

    // Load meeting
    loadMeeting();

    // Listen to meeting updates
    const unsubscribeMeeting = listenToMeeting(meetingId, (meetingData) => {
      setMeeting(meetingData);
    });

    // Listen to participants
    const unsubscribeParticipants = listenToParticipants(meetingId, (participantsData) => {
      setParticipants(participantsData);
    });

    // Join meeting
    if (meeting) {
      joinMeeting(meetingId, user.uid, meeting.type === 'screen_share' ? 'video' : meeting.type, meeting.hostUid === user.uid ? 'host' : 'participant');
    }

    // Get local media
    initializeLocalMedia();

    return () => {
      unsubscribeMeeting();
      unsubscribeParticipants();
      cleanup();
    };
  }, [meetingId, user]);

  const loadMeeting = async () => {
    if (!meetingId) return;
    try {
      const meetingData = await getMeeting(meetingId);
      if (!meetingData) {
        setError('Meeting not found');
        navigate('/');
        return;
      }
      setMeeting(meetingData);
      setLoading(false);
    } catch (err) {
      setError('Failed to load meeting');
      setLoading(false);
    }
  };

  const initializeLocalMedia = async () => {
    try {
      const stream = await getUserMedia(true, meeting?.type !== 'audio');
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Failed to access camera/microphone');
    }
  };

  const toggleMute = async () => {
    if (!localStream) return;
    const newMutedState = !isMuted;
    toggleAudioTrack(localStream, !newMutedState);
    setIsMuted(newMutedState);
    
    if (meetingId && user) {
      await updateParticipantState(meetingId, user.uid, { isMuted: newMutedState });
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    const newVideoState = !isVideoOff;
    toggleVideoTrack(localStream, !newVideoState);
    setIsVideoOff(newVideoState);
    
    if (meetingId && user) {
      await updateParticipantState(meetingId, user.uid, { isVideoOff: newVideoState });
    }
  };

  const toggleScreenShare = async () => {
    // Screen share implementation
    setIsScreenSharing(!isScreenSharing);
  };

  const handleLeave = async () => {
    if (meetingId && user) {
      await leaveMeeting(meetingId, user.uid);
    }
    cleanup();
    navigate('/');
  };

  const handleEndMeeting = async () => {
    if (meetingId && user && meeting?.hostUid === user.uid) {
      if (window.confirm('Are you sure you want to end this meeting for everyone?')) {
        await endMeeting(meetingId);
      }
    }
    handleLeave();
  };

  const cleanup = () => {
    if (localStream) {
      stopMediaStream(localStream);
    }
    
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    
    remoteStreamsRef.current.clear();
  };

  const copyMeetingLink = () => {
    if (meetingId) {
      navigator.clipboard.writeText(`${window.location.origin}/meeting/${meetingId}`);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <p className="text-xl mb-4">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  const isHost = meeting?.hostUid === user?.uid;

  return (
    <div className={`flex flex-col h-screen bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h1 className="text-white font-semibold">{meeting?.title || meeting?.type === 'audio' ? 'Audio Call' : 'Video Call'}</h1>
          <span className="text-gray-400 text-sm">
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={copyMeetingLink}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Copy meeting link"
          >
            <Copy size={20} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              End Meeting
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className={`flex-1 p-4 grid gap-4 ${showParticipants || showChat ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center">
                  <span className="text-4xl text-white font-bold">
                    {user?.displayName?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 flex items-center space-x-2">
              <span className="px-3 py-1 bg-black/50 text-white text-sm rounded-full backdrop-blur-sm">
                You
              </span>
              {isMuted && (
                <div className="p-2 bg-red-500 rounded-full">
                  <MicOff size={16} className="text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Remote Videos */}
          {participants
            .filter(p => p.userId !== user?.uid)
            .map(participant => (
              <div key={participant.userId} className="relative bg-gray-800 rounded-xl overflow-hidden">
                {remoteStreamsRef.current.get(participant.userId) ? (
                  <video
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(ref) => {
                      if (ref && remoteStreamsRef.current.get(participant.userId)) {
                        ref.srcObject = remoteStreamsRef.current.get(participant.userId);
                      }
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-4xl text-white font-bold">
                        {participant.userId.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                  <span className="px-3 py-1 bg-black/50 text-white text-sm rounded-full backdrop-blur-sm">
                    Participant
                  </span>
                  {participant.isMuted && (
                    <div className="p-2 bg-red-500 rounded-full">
                      <MicOff size={16} className="text-white" />
                    </div>
                  )}
                  {participant.isScreenSharing && (
                    <div className="p-2 bg-blue-500 rounded-full">
                      <Monitor size={16} className="text-white" />
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Sidebar */}
        {(showParticipants || showChat) && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-white font-semibold">
                {showParticipants ? 'Participants' : 'Chat'}
              </h2>
              <button
                onClick={() => {
                  setShowParticipants(false);
                  setShowChat(false);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {showParticipants && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {participants.map(participant => (
                  <div
                    key={participant.userId}
                    className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {participant.userId.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">
                        {participant.userId === user?.uid ? 'You' : 'Participant'}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {participant.role === 'host' ? 'Host' : 'Participant'}
                      </p>
                    </div>
                    {participant.isMuted && (
                      <MicOff size={16} className="text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {showChat && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto">
                  <p className="text-gray-400 text-center text-sm">Chat messages will appear here</p>
                </div>
                <div className="p-4 border-t border-gray-700">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-center space-x-4 px-6 py-4 bg-gray-800 border-t border-gray-700">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all ${
            isMuted 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${
            isVideoOff 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>
        
        <button
          onClick={toggleScreenShare}
          className={`p-4 rounded-full transition-all ${
            isScreenSharing 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
        </button>
        
        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className={`p-4 rounded-full transition-all ${
            showParticipants 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title="Participants"
        >
          <Users size={24} />
        </button>
        
        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-4 rounded-full transition-all ${
            showChat 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title="Chat"
        >
          <MessageSquare size={24} />
        </button>
        
        <div className="w-px h-12 bg-gray-600 mx-2" />
        
        <button
          onClick={handleLeave}
          className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
          title="Leave meeting"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
};
