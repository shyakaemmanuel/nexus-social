import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  getDoc,
  limit,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Users,
  Settings,
  Maximize,
  Grid,
  Layout,
  Circle,
  Square,
  Loader2,
  X,
  Search,
  UserPlus,
  Check,
  MessageSquare,
  Send,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { uploadVideoToCloudinary } from '../lib/cloudinary';
import { MeetingLobby } from '../components/MeetingLobby';

interface PeerConnection {
  uid: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function MeetingRoom() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [uid: string]: MediaStream }>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('grid');
  const [meetingTitle, setMeetingTitle] = useState('Meeting');
  const [participantsCount, setParticipantsCount] = useState(1);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'poor'>('connecting');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [meetingStartTime, setMeetingStartTime] = useState<Date | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const pcs = useRef<{ [uid: string]: RTCPeerConnection }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const signalingUnsubscribe = useRef<() => void>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const handleJoinFromLobby = async (stream: MediaStream) => {
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    setShowLobby(false);
    setMeetingStartTime(new Date());
    await joinMeeting(stream);
  };

  // Format duration as HH:MM:SS
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update duration every second
  useEffect(() => {
    if (!showLobby && meetingStartTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - meetingStartTime.getTime()) / 1000);
        setMeetingDuration(diff);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [showLobby, meetingStartTime]);

  useEffect(() => {
    if (!user || !meetingId) return;

    const init = async () => {
      try {
        // Get Meeting Info
        const meetingSnap = await getDoc(doc(db, 'meetings', meetingId));
        if (meetingSnap.exists()) {
          const data = meetingSnap.data();
          setMeetingTitle(data.title);
          setIsHost(data.hostUid === user.uid);
        }
      } catch (error) {
        // Error getting meeting info
      }
    };

    init();
  }, [meetingId, user]);

  const muteParticipant = async (participantUid: string) => {
    try {
      await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
        type: 'mute',
        from: user?.uid,
        to: participantUid,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `meetings/${meetingId}/signaling`);
    }
  };

  const removeParticipant = async (participantUid: string) => {
    try {
      await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
        type: 'remove',
        from: user?.uid,
        to: participantUid,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `meetings/${meetingId}/signaling`);
    }
  };

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev.slice(-4), message]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 5000);
  };

  useEffect(() => {
    if (!showLobby && localStream) {
      return () => {
        leaveMeeting();
      };
    }
  }, [showLobby, localStream]);

  const joinMeeting = async (stream: MediaStream) => {
    if (!user || !meetingId) return;

    setConnectionStatus('connecting');

    // Signal presence
    try {
      await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
        type: 'join',
        from: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        timestamp: serverTimestamp()
      });
      setConnectionStatus('connected');
      addNotification('You joined the meeting');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `meetings/${meetingId}/signaling`);
      setConnectionStatus('poor');
    }

    // Listen for signals
    const q = query(
      collection(db, 'meetings', meetingId, 'signaling'),
      where('from', '!=', user.uid)
    );

    signalingUnsubscribe.current = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const signal = change.doc.data();

          if (signal.type === 'join') {
            // Someone joined, create an offer to them
            createPeerConnection(signal.from, stream, true);
            addNotification(`${signal.displayName} joined the meeting`);
          } else if (signal.type === 'offer' && signal.to === user.uid) {
            // Received an offer, create an answer
            handleOffer(signal.from, JSON.parse(signal.data), stream);
          } else if (signal.type === 'answer' && signal.to === user.uid) {
            // Received an answer
            handleAnswer(signal.from, JSON.parse(signal.data));
          } else if (signal.type === 'candidate' && signal.to === user.uid) {
            // Received ICE candidate
            handleCandidate(signal.from, JSON.parse(signal.data));
          } else if (signal.type === 'leave') {
            removePeer(signal.from);
            addNotification('A participant left the meeting');
          } else if (signal.type === 'mute' && signal.to === user.uid) {
            // Host muted you
            if (localStream) {
              localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
              });
              setIsMuted(true);
              addNotification('Host muted your microphone');
            }
          } else if (signal.type === 'remove' && signal.to === user.uid) {
            // Host removed you
            addNotification('You were removed from the meeting by the host');
            setTimeout(() => leaveMeeting(), 2000);
          }
        }
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `meetings/${meetingId}/signaling`);
      setConnectionStatus('poor');
    });
  };

  const createPeerConnection = async (remoteUid: string, stream: MediaStream, isCaller: boolean) => {
    if (pcs.current[remoteUid]) return pcs.current[remoteUid];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcs.current[remoteUid] = pc;

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle remote tracks
    pc.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [remoteUid]: event.streams[0]
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && user && meetingId) {
        addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
          type: 'candidate',
          from: user.uid,
          to: remoteUid,
          data: JSON.stringify(event.candidate),
          timestamp: serverTimestamp()
        }).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, `meetings/${meetingId}/signaling`);
        });
      }
    };

    if (isCaller) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        if (user && meetingId) {
          await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
            type: 'offer',
            from: user.uid,
            to: remoteUid,
            data: JSON.stringify(offer),
            timestamp: serverTimestamp()
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `meetings/${meetingId}/signaling`);
      }
    }
    
    return pc;
  };

  const handleOffer = async (remoteUid: string, offer: RTCSessionDescriptionInit, stream: MediaStream) => {
    const pc = await createPeerConnection(remoteUid, stream, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (user && meetingId) {
      try {
        await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
          type: 'answer',
          from: user.uid,
          to: remoteUid,
          data: JSON.stringify(answer),
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `meetings/${meetingId}/signaling`);
      }
    }
  };

  const handleAnswer = async (remoteUid: string, answer: RTCSessionDescriptionInit) => {
    const pc = pcs.current[remoteUid];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleCandidate = async (remoteUid: string, candidate: RTCIceCandidateInit) => {
    const pc = pcs.current[remoteUid];
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const removePeer = (uid: string) => {
    if (pcs.current[uid]) {
      pcs.current[uid].close();
      delete pcs.current[uid];
    }
    setPeers(prev => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
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

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        setScreenStream(stream);
        setIsScreenSharing(true);

        // Add screen share tracks to all peer connections
        Object.values(pcs.current).forEach(pc => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        });

        // Handle when user stops sharing
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } catch (error) {
        alert('Could not start screen sharing. Please check permissions.');
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };

  const startRecording = () => {
    if (!localStream) return;
    
    recordedChunks.current = [];
    const recorder = new MediaRecorder(localStream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      await uploadRecording(blob);
    };

    recorder.start();
    mediaRecorder.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const uploadRecording = async (blob: Blob) => {
    if (!user || !meetingId) return;
    setIsUploading(true);
    
    try {
      const recordingId = `${Date.now()}_${user.uid}`;
      
      const url = await uploadVideoToCloudinary(blob as File, `recordings/${meetingId}`);
      
      await addDoc(collection(db, 'recordings'), {
        meetingId,
        userId: user.uid,
        url,
        createdAt: serverTimestamp()
      });
      
      alert('Recording saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'recordings');
      alert('Failed to save recording.');
    } finally {
      setIsUploading(false);
    }
  };

  const leaveMeeting = async () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveMeeting = async () => {
    if (signalingUnsubscribe.current) signalingUnsubscribe.current();

    if (user && meetingId) {
      try {
        await addDoc(collection(db, 'meetings', meetingId, 'signaling'), {
          type: 'leave',
          from: user.uid,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `meetings/${meetingId}/signaling`);
      }
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    Object.values(pcs.current).forEach((pc: any) => {
      if (pc) pc.close();
    });
    pcs.current = {};

    navigate('/meetings');
  };

  const peerUids = Object.keys(peers);
  const totalParticipants = peerUids.length + 1;

  if (showLobby) {
    return <MeetingLobby meetingId={meetingId || ''} onJoin={handleJoinFromLobby} />;
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col text-white z-[100]">
      {/* Header */}
      <div className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center space-x-6">
          <div className="bg-accent/10 p-3 rounded-2xl border border-accent/20">
            <VideoIcon className="text-accent" size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="font-black text-lg tracking-tight">{meetingTitle}</h1>
              <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>Live</span>
              </div>
              {isRecording && (
                <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/20 animate-pulse">
                  <Circle size={8} fill="currentColor" />
                  <span>Recording</span>
                </div>
              )}
              <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                connectionStatus === 'connected' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                connectionStatus === 'connecting' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                <span>{connectionStatus}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 mt-1 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              <span className="flex items-center space-x-1">
                <Users size={12} />
                <span>{totalParticipants} participants</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>{formatDuration(meetingDuration)}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Room ID: {meetingId?.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center bg-zinc-800/50 rounded-2xl p-1 border border-white/5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode('speaker')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'speaker' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Layout size={20} />
            </button>
          </div>
          <button className="p-3 hover:bg-white/5 rounded-2xl transition-all text-zinc-400 hover:text-white border border-transparent hover:border-white/5">
            <Settings size={22} />
          </button>
          <button className="p-3 hover:bg-white/5 rounded-2xl transition-all text-zinc-400 hover:text-white border border-transparent hover:border-white/5">
            <Maximize size={22} />
          </button>
        </div>
      </div>

      {/* Notifications Overlay */}
      <AnimatePresence>
        {notifications.length > 0 && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center space-y-2">
            {notifications.map((notification, index) => (
              <motion.div
                key={`${notification}-${index}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-sm font-medium shadow-lg"
              >
                {notification}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-6 overflow-hidden relative">
          <div className={`grid gap-4 h-full w-full ${
            viewMode === 'speaker' ? 'grid-cols-1' :
            totalParticipants === 1 ? 'grid-cols-1' :
            totalParticipants === 2 ? 'grid-cols-1 md:grid-cols-2' :
            totalParticipants <= 4 ? 'grid-cols-2' :
            'grid-cols-2 md:grid-cols-3'
          }`}>
            {/* Local Video */}
            <div className={`relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 group shadow-2xl transition-all duration-500 ${
              viewMode === 'speaker' && totalParticipants > 1 ? 'absolute bottom-6 right-6 w-48 h-32 z-10' : ''
            }`}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
              />
              {isCameraOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-zinc-700 flex items-center justify-center text-2xl md:text-4xl font-bold">
                    {user?.displayName?.[0]}
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <span className="text-[10px] md:text-xs font-medium">You</span>
                {isMuted && <MicOff size={12} className="text-red-500" />}
              </div>
            </div>

            {/* Remote Videos */}
            {peerUids.map((uid, index) => (
              <RemoteVideo 
                key={uid} 
                stream={peers[uid]} 
                uid={uid} 
                isSpeaker={viewMode === 'speaker' && index === 0}
              />
            ))}
          </div>
        </div>

        {/* Participant List Sidebar */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              className="w-96 bg-zinc-900/50 backdrop-blur-2xl border-l border-white/5 flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-xl tracking-tight">Participants</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{totalParticipants} people in call</p>
                </div>
                <button 
                  onClick={() => setShowParticipants(false)}
                  className="p-3 hover:bg-white/5 rounded-2xl transition-all text-zinc-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
                <div className="group flex items-center justify-between p-4 bg-white/5 rounded-[1.5rem] border border-white/5 transition-all hover:bg-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img
                        src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`}
                        className="w-12 h-12 rounded-full border-2 border-accent/20 object-cover"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-900" />
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-tight">{user?.displayName} <span className="text-accent text-[10px] ml-1">(You)</span></p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Host</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl ${isMuted ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    </div>
                    <div className={`p-2 rounded-xl ${isCameraOff ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {isCameraOff ? <VideoOff size={16} /> : <VideoIcon size={16} />}
                    </div>
                  </div>
                </div>

                <div className="py-4">
                  <div className="h-px bg-white/5 w-full" />
                </div>

                {peerUids.map(uid => (
                  <ParticipantItem key={uid} uid={uid} isHost={isHost} onMute={muteParticipant} onRemove={removeParticipant} />
                ))}
              </div>

              <div className="p-8 border-t border-white/5 bg-zinc-900/80">
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className="w-full py-4 bg-accent hover:bg-accent/90 border border-accent/20 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20"
                >
                  Invite Others
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <MeetingChat 
              meetingId={meetingId || ''} 
              currentUser={user} 
              isOpen={showChat} 
              onClose={() => setShowChat(false)} 
            />
          )}
        </AnimatePresence>

        <InviteModal 
          isOpen={isInviteModalOpen} 
          onClose={() => setIsInviteModalOpen(false)} 
          meetingId={meetingId || ''}
          meetingTitle={meetingTitle}
          currentUser={user}
          sendNotification={sendNotification}
        />
      </div>

      {/* Controls */}
      <div className="h-auto py-6 px-8 flex items-center justify-center bg-gradient-to-t from-zinc-950 via-zinc-900/95 to-transparent border-t border-white/5">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Main Controls */}
          <div className="flex items-center gap-2 md:gap-3 bg-white/5 backdrop-blur-xl p-2 md:p-3 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={toggleMute}
              className={`p-3 md:p-4 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-3 md:p-4 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                isCameraOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCameraOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3 md:p-4 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                isScreenSharing ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
            </button>
          </div>

          {/* Recording */}
          <div className="flex items-center bg-white/5 backdrop-blur-xl p-2 md:p-3 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
              className={`p-3 md:p-4 rounded-full transition-all duration-200 flex items-center gap-2 hover:scale-105 active:scale-95 ${
                isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
              } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isUploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isRecording ? (
                <Square size={18} fill="currentColor" />
              ) : (
                <Circle size={18} fill="currentColor" />
              )}
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider hidden md:block">
                {isUploading ? 'Saving' : isRecording ? 'Stop' : 'Record'}
              </span>
            </button>
          </div>

          {/* End Call */}
          <button
            onClick={leaveMeeting}
            className="p-4 md:p-5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xl shadow-red-600/30"
            title="End call"
          >
            <PhoneOff size={24} />
          </button>

          {/* Secondary Controls */}
          <div className="flex items-center gap-2 md:gap-3 bg-white/5 backdrop-blur-xl p-2 md:p-3 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={() => {
                setShowParticipants(!showParticipants);
                if (showChat) setShowChat(false);
              }}
              className={`p-3 md:p-4 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                showParticipants ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Participants"
            >
              <Users size={20} />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
                {totalParticipants}
              </span>
            </button>

            <button
              onClick={() => {
                setShowChat(!showChat);
                if (showParticipants) setShowParticipants(false);
              }}
              className={`p-3 md:p-4 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 relative ${
                showChat ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Chat"
            >
              <MessageSquare size={20} />
            </button>

            <button
              className="p-3 md:p-4 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 bg-white/10 hover:bg-white/20 text-white"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/10"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PhoneOff size={32} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Leave Meeting?</h2>
                <p className="text-zinc-400 text-sm">Are you sure you want to leave this meeting? This action cannot be undone.</p>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLeaveMeeting}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-600/30"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RemoteVideo: React.FC<{ stream: MediaStream, uid: string, isSpeaker?: boolean }> = ({ stream, uid, isSpeaker }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [userName, setUserName] = useState('Participant');
  const [photoURL, setPhotoURL] = useState('');

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    // Fetch user info
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setUserName(data.displayName);
        setPhotoURL(data.photoURL);
      }
    }).catch(err => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    });
  }, [stream, uid]);

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 group shadow-2xl transition-all duration-500 ${
      isSpeaker ? 'ring-2 ring-accent ring-offset-4 ring-offset-zinc-950' : ''
    }`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
        <span className="text-xs font-medium">{userName}</span>
      </div>
      {isSpeaker && (
        <div className="absolute top-4 right-4 bg-accent text-white px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg">
          Speaker
        </div>
      )}
    </div>
  );
};

const ParticipantItem: React.FC<{ uid: string, isHost: boolean, onMute: (uid: string) => Promise<void>, onRemove: (uid: string) => Promise<void> }> = ({ uid, isHost, onMute, onRemove }) => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        setUser(snap.data());
      }
    }).catch(err => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    });
  }, [uid]);

  if (!user) return null;

  return (
    <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-[1.5rem] border border-transparent hover:border-white/5 transition-all">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
            className="w-12 h-12 rounded-full border border-white/10 object-cover"
          />
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-900 ${
            user.status === 'online' ? 'bg-green-500' :
            user.status === 'away' ? 'bg-yellow-500' :
            user.status === 'busy' ? 'bg-red-500' : 'bg-zinc-500'
          }`} />
        </div>
        <div>
          <p className="text-sm font-black tracking-tight">{user.displayName}</p>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Participant</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {isHost ? (
          <>
            <button
              onClick={() => onMute(uid)}
              className="p-2 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-xl transition-all"
              title="Mute participant"
            >
              <VolumeX size={16} />
            </button>
            <button
              onClick={() => onRemove(uid)}
              className="p-2 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-xl transition-all"
              title="Remove participant"
            >
              <Ban size={16} />
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-2 bg-green-500/10 text-green-500 rounded-xl">
              <Mic size={16} />
            </div>
            <div className="p-2 bg-green-500/10 text-green-500 rounded-xl">
              <VideoIcon size={16} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MeetingChat = ({ meetingId, currentUser, isOpen, onClose }: { meetingId: string, currentUser: any, isOpen: boolean, onClose: () => void }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!meetingId || !isOpen) return;

    const q = query(
      collection(db, 'meetings', meetingId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `meetings/${meetingId}/messages`);
    });

    return () => unsubscribe();
  }, [meetingId, isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !meetingId) return;

    try {
      await addDoc(collection(db, 'meetings', meetingId, 'messages'), {
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        content: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `meetings/${meetingId}/messages`);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 350, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 350, opacity: 0 }}
      className="w-96 bg-zinc-900/50 backdrop-blur-2xl border-l border-white/5 flex flex-col shadow-2xl"
    >
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="font-black text-xl tracking-tight">Chat</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">In-meeting messages</p>
        </div>
        <button 
          onClick={onClose}
          className="p-3 hover:bg-white/5 rounded-2xl transition-all text-zinc-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.senderUid === currentUser?.uid ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{msg.senderName}</span>
              <span className="text-[10px] text-zinc-600 font-bold">
                {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
              </span>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] ${
              msg.senderUid === currentUser?.uid 
                ? 'bg-accent text-white rounded-tr-none' 
                : 'bg-white/5 text-zinc-200 rounded-tl-none border border-white/5'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="p-6 border-t border-white/5 bg-zinc-900/80">
        <div className="relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="w-full pl-4 pr-12 py-4 bg-zinc-800 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-2 p-2 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:bg-zinc-700"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const InviteModal = ({ 
  isOpen, 
  onClose, 
  meetingId, 
  meetingTitle, 
  currentUser,
  sendNotification 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  meetingId: string, 
  meetingTitle: string,
  currentUser: any,
  sendNotification: any
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitedUids, setInvitedUids] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const q = query(collection(db, 'users'), limit(20));
    getDocs(q).then(snapshot => {
      const usersData = snapshot.docs
        .map(doc => doc.data())
        .filter(u => u.uid !== currentUser?.uid);
      setUsers(usersData);
      setLoading(false);
    });
  }, [isOpen, currentUser]);

  const handleInvite = async (user: any) => {
    if (invitedUids.includes(user.uid)) return;
    
    try {
      await sendNotification(
        user.uid,
        'meeting_invite',
        `Meeting Invite: ${meetingTitle}`,
        `${currentUser.displayName} invited you to join their meeting.`,
        { meetingId }
      );
      setInvitedUids(prev => [...prev, user.uid]);
    } catch (error) {
      // Error sending invite
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 border border-white/10 shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black">Invite Participants</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Search by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-zinc-800 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-accent transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
          {loading ? (
            <div className="text-center py-10 text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading users...</div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center space-x-3">
                  <img
                    src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-bold">{u.displayName}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">{u.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleInvite(u)}
                  disabled={invitedUids.includes(u.uid)}
                  className={`p-2.5 rounded-xl transition-all ${
                    invitedUids.includes(u.uid) 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {invitedUids.includes(u.uid) ? <Check size={18} /> : <UserPlus size={18} />}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
