import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, query, collection } from 'firebase/firestore';
import { db } from './firebase';

// WebRTC configuration with public STUN servers
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
};

// Signaling data types
export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from: string;
  to: string;
  timestamp: any;
}

// Create a peer connection
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(rtcConfig);
}

// Send signaling data via Firestore
export async function sendSignalingData(
  meetingId: string,
  data: SignalingData
): Promise<void> {
  const signalingRef = doc(db, `meetings/${meetingId}/signaling`, `${data.from}_${data.to}`);
  await setDoc(signalingRef, {
    ...data,
    timestamp: serverTimestamp()
  });
}

// Listen for signaling data
export function listenToSignalingData(
  meetingId: string,
  userId: string,
  callback: (data: SignalingData) => void
): () => void {
  // Listen to signals sent to this user
  const unsubscribe = onSnapshot(
    query(collection(db, `meetings/${meetingId}/signaling`)),
    (snapshot) => {
      snapshot.docs.forEach(doc => {
        const data = doc.data() as SignalingData;
        if (data.to === userId) {
          callback(data);
        }
      });
    }
  );
  return unsubscribe;
}

// Create and send an offer
export async function createOffer(
  peerConnection: RTCPeerConnection,
  meetingId: string,
  fromUserId: string,
  toUserId: string
): Promise<RTCSessionDescriptionInit> {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  await sendSignalingData(meetingId, {
    type: 'offer',
    sdp: offer,
    from: fromUserId,
    to: toUserId,
    timestamp: serverTimestamp()
  });
  
  return offer;
}

// Create and send an answer
export async function createAnswer(
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit,
  meetingId: string,
  fromUserId: string,
  toUserId: string
): Promise<RTCSessionDescriptionInit> {
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  await sendSignalingData(meetingId, {
    type: 'answer',
    sdp: answer,
    from: fromUserId,
    to: toUserId,
    timestamp: serverTimestamp()
  });
  
  return answer;
}

// Handle ICE candidates
export function handleIceCandidate(
  peerConnection: RTCPeerConnection,
  meetingId: string,
  fromUserId: string,
  toUserId: string
): void {
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendSignalingData(meetingId, {
        type: 'ice-candidate',
        candidate: event.candidate.toJSON(),
        from: fromUserId,
        to: toUserId,
        timestamp: serverTimestamp()
      });
    }
  };
}

// Add received ICE candidate
export async function addIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await peerConnection.addIceCandidate(candidate);
}

// Get user media (camera/microphone)
export async function getUserMedia(
  audio: boolean = true,
  video: boolean = true
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio, video });
}

// Get screen share media
export async function getScreenShareMedia(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true
  });
}

// Stop all tracks in a media stream
export function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

// Toggle audio track
export function toggleAudioTrack(stream: MediaStream, enabled: boolean): void {
  stream.getAudioTracks().forEach(track => {
    track.enabled = enabled;
  });
}

// Toggle video track
export function toggleVideoTrack(stream: MediaStream, enabled: boolean): void {
  stream.getVideoTracks().forEach(track => {
    track.enabled = enabled;
  });
}

// Replace video track (for screen sharing)
export function replaceVideoTrack(
  peerConnection: RTCPeerConnection,
  sender: RTCRtpSender,
  newStream: MediaStream
): void {
  const videoTrack = newStream.getVideoTracks()[0];
  if (videoTrack) {
    sender.replaceTrack(videoTrack);
  }
}

// Get local media stream with constraints
export async function getLocalMediaStream(
  constraints: MediaStreamConstraints
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(constraints);
}

// Check if browser supports WebRTC
export function isWebRTCSupported(): boolean {
  return !!(RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
}

// Get available media devices
export async function getMediaDevices(): Promise<MediaDeviceInfo[]> {
  return navigator.mediaDevices.enumerateDevices();
}

// Get audio input devices
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await getMediaDevices();
  return devices.filter(device => device.kind === 'audioinput');
}

// Get video input devices
export async function getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await getMediaDevices();
  return devices.filter(device => device.kind === 'videoinput');
}

// Change audio input device
export async function changeAudioInputDevice(
  stream: MediaStream,
  deviceId: string
): Promise<void> {
  const newStream = await getLocalMediaStream({
    audio: { deviceId: { exact: deviceId } },
    video: false
  });
  
  const audioTrack = newStream.getAudioTracks()[0];
  const oldAudioTrack = stream.getAudioTracks()[0];
  
  if (audioTrack && oldAudioTrack) {
    stream.removeTrack(oldAudioTrack);
    stream.addTrack(audioTrack);
    oldAudioTrack.stop();
  }
}

// Change video input device
export async function changeVideoInputDevice(
  stream: MediaStream,
  deviceId: string
): Promise<void> {
  const newStream = await getLocalMediaStream({
    audio: false,
    video: { deviceId: { exact: deviceId } }
  });
  
  const videoTrack = newStream.getVideoTracks()[0];
  const oldVideoTrack = stream.getVideoTracks()[0];
  
  if (videoTrack && oldVideoTrack) {
    stream.removeTrack(oldVideoTrack);
    stream.addTrack(videoTrack);
    oldVideoTrack.stop();
  }
}

// Create a data channel for chat in call
export function createDataChannel(
  peerConnection: RTCPeerConnection,
  label: string = 'chat'
): RTCDataChannel {
  return peerConnection.createDataChannel(label);
}

// Listen for data channel messages
export function listenToDataChannel(
  dataChannel: RTCDataChannel,
  callback: (message: string) => void
): void {
  dataChannel.onmessage = (event) => {
    callback(event.data);
  };
}

// Send message via data channel
export function sendDataChannelMessage(
  dataChannel: RTCDataChannel,
  message: string
): void {
  dataChannel.send(message);
}

// Cleanup peer connection
export function cleanupPeerConnection(peerConnection: RTCPeerConnection): void {
  peerConnection.close();
}

// Get connection statistics
export async function getConnectionStats(
  peerConnection: RTCPeerConnection
): Promise<RTCStatsReport> {
  return peerConnection.getStats();
}
