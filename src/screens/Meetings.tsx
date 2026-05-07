import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Video, Plus, Search, Calendar, Users, ArrowRight, Play, Trash2, X, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  hostUid: string;
  status: 'active' | 'ended' | 'scheduled';
  scheduledAt?: any;
  createdAt: any;
}

export default function Meetings() {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduledMeetings, setScheduledMeetings] = useState<Meeting[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    const q = query(
      collection(db, 'meetings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meetingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Meeting[];
      setMeetings(meetingsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'meetings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'meetings'),
      where('status', '==', 'scheduled'),
      orderBy('scheduledAt', 'asc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meetingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Meeting[];
      setScheduledMeetings(meetingsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'meetings');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingTitle.trim() || !user) return;

    setCreating(true);
    try {
      const meetingData: any = {
        title: newMeetingTitle.trim(),
        hostUid: user.uid,
        status: isScheduled ? 'scheduled' : 'active',
        createdAt: serverTimestamp()
      };

      if (isScheduled && scheduledDate && scheduledTime) {
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
        meetingData.scheduledAt = scheduledAt;
      }

      const docRef = await addDoc(collection(db, 'meetings'), meetingData);
      
      // If it's a scheduled meeting, we could notify followers or a specific list
      // For now, let's assume we want to notify people about the new meeting
      // In a real app, you'd have an invite list. Let's just create the meeting for now.

      setIsCreateModalOpen(false);
      setNewMeetingTitle('');
      setScheduledDate('');
      setScheduledTime('');
      setIsScheduled(false);
      
      if (!isScheduled) {
        navigate(`/meetings/${docRef.id}`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meetings');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">Nexus Meetings</h1>
          <p className="text-secondary text-lg mt-2 font-medium">Connect with your team in real-time video rooms.</p>
        </div>
        
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center space-x-3 px-8 py-4 bg-accent text-white rounded-2xl font-bold hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 active:scale-95"
        >
          <Plus size={24} />
          <span>New Meeting</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-background p-6 rounded-[2rem] border border-border shadow-sm flex items-center space-x-4 transition-all hover:shadow-xl hover:shadow-accent/5"
        >
          <div className="p-4 bg-accent/10 rounded-2xl text-accent">
            <Video size={28} />
          </div>
          <div>
            <p className="text-secondary text-xs font-bold uppercase tracking-wider">Active Rooms</p>
            <p className="text-3xl font-black text-primary">{meetings.length}</p>
          </div>
        </motion.div>
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-background p-6 rounded-[2rem] border border-border shadow-sm flex items-center space-x-4 transition-all hover:shadow-xl hover:shadow-blue-500/5"
        >
          <div className="p-4 bg-blue-50 rounded-2xl text-blue-500">
            <Users size={28} />
          </div>
          <div>
            <p className="text-secondary text-xs font-bold uppercase tracking-wider">Participants</p>
            <p className="text-3xl font-black text-primary">128</p>
          </div>
        </motion.div>
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-background p-6 rounded-[2rem] border border-border shadow-sm flex items-center space-x-4 transition-all hover:shadow-xl hover:shadow-green-500/5"
        >
          <div className="p-4 bg-green-50 rounded-2xl text-green-500">
            <Calendar size={28} />
          </div>
          <div>
            <p className="text-secondary text-xs font-bold uppercase tracking-wider">Scheduled</p>
            <p className="text-3xl font-black text-primary">{scheduledMeetings.length}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center justify-between mb-10">
        <div className="flex bg-surface p-1.5 rounded-2xl border border-border">
          <button
            onClick={() => setViewMode('list')}
            className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-background text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-background text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}
          >
            Calendar
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-16">
          {/* Live Meetings */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.5)]" />
                <span>Live Meetings</span>
              </h2>
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">{meetings.length} Active</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-background border border-border rounded-[2.5rem] h-56 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {meetings.map(meeting => (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -8 }}
                    className="group bg-background border border-border rounded-[2.5rem] p-8 hover:border-accent hover:shadow-2xl hover:shadow-accent/10 transition-all cursor-pointer relative overflow-hidden"
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                    
                    <div className="flex items-start justify-between mb-6 relative z-10">
                      <div className="p-4 bg-surface rounded-2xl group-hover:bg-accent group-hover:text-white transition-all duration-300">
                        <Video size={28} />
                      </div>
                      <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>Join Now</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black mb-2 group-hover:text-accent transition-colors line-clamp-1">{meeting.title}</h3>
                    <p className="text-secondary text-xs font-medium mb-8">
                      Started {meeting.createdAt ? formatDistanceToNow(meeting.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                    </p>
                    
                    <div className="flex items-center justify-between pt-6 border-t border-border/50 relative z-10">
                      <div className="flex -space-x-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-4 border-background bg-surface flex items-center justify-center text-xs font-black shadow-sm">
                            {i}
                          </div>
                        ))}
                        <div className="w-10 h-10 rounded-full border-4 border-background bg-accent text-white flex items-center justify-center text-xs font-black shadow-md">
                          +5
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all shadow-sm">
                        <ArrowRight size={24} />
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {meetings.length === 0 && (
                  <div className="col-span-full bg-surface border-2 border-dashed border-border rounded-[3rem] p-16 text-center">
                    <div className="w-20 h-20 bg-background rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
                      <Video size={40} className="text-zinc-300" />
                    </div>
                    <p className="text-secondary font-bold text-lg">No live meetings right now.</p>
                    <p className="text-secondary/60 text-sm mt-1">Be the first to start a conversation!</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Scheduled Meetings */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black flex items-center space-x-3">
                <Calendar size={28} className="text-accent" />
                <span>Upcoming Events</span>
              </h2>
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">{scheduledMeetings.length} Scheduled</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {scheduledMeetings.map(meeting => (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -8 }}
                  className="group bg-background border border-border rounded-[2.5rem] p-8 hover:border-accent hover:shadow-2xl hover:shadow-accent/10 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />

                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="p-4 bg-surface rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                      <Calendar size={28} />
                    </div>
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                      Scheduled
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black mb-2 group-hover:text-accent transition-colors line-clamp-1">{meeting.title}</h3>
                  <div className="flex items-center space-x-2 text-accent font-black text-sm mb-1">
                    <Calendar size={14} />
                    <span>{meeting.scheduledAt ? format(meeting.scheduledAt.toDate(), 'MMMM d, yyyy') : 'Date TBD'}</span>
                  </div>
                  <p className="text-secondary text-xs font-bold mb-8 uppercase tracking-wider">
                    at {meeting.scheduledAt ? format(meeting.scheduledAt.toDate(), 'HH:mm') : 'Time TBD'}
                  </p>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-border/50 relative z-10">
                    <button 
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      className="px-8 py-3 bg-primary text-white rounded-2xl text-xs font-black hover:bg-accent transition-all shadow-lg shadow-primary/10"
                    >
                      Join Early
                    </button>
                    <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-secondary">
                      <Users size={20} />
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {scheduledMeetings.length === 0 && (
                <div className="col-span-full bg-surface border-2 border-dashed border-border rounded-[3rem] p-16 text-center">
                  <div className="w-20 h-20 bg-background rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
                    <Calendar size={40} className="text-zinc-300" />
                  </div>
                  <p className="text-secondary font-bold text-lg">Your calendar is clear.</p>
                  <p className="text-secondary/60 text-sm mt-1">Schedule a meeting to see it here.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-background border border-border rounded-[3rem] p-10 md:p-16 shadow-2xl shadow-accent/5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
            <div>
              <h2 className="text-3xl font-black text-primary">April 2026</h2>
              <p className="text-secondary font-bold mt-1 uppercase tracking-widest text-xs">Your Monthly Schedule</p>
            </div>
            <div className="flex space-x-3">
              <button className="p-4 hover:bg-surface rounded-2xl border border-border transition-all hover:scale-105 active:scale-95">
                <ArrowRight size={24} className="rotate-180" />
              </button>
              <button className="p-4 hover:bg-surface rounded-2xl border border-border transition-all hover:scale-105 active:scale-95">
                <ArrowRight size={24} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3 md:gap-6">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-secondary/60 py-4">
                {day}
              </div>
            ))}
            {Array.from({ length: 30 }).map((_, i) => {
              const day = i + 1;
              const hasMeeting = scheduledMeetings.some(m => m.scheduledAt && m.scheduledAt.toDate().getDate() === day);
              return (
                <motion.div 
                  key={i} 
                  whileHover={{ y: -4, scale: 1.02 }}
                  className={`aspect-square rounded-[1.5rem] border p-3 md:p-6 flex flex-col justify-between transition-all cursor-pointer relative group ${
                    hasMeeting 
                      ? 'bg-accent/5 border-accent/20 shadow-lg shadow-accent/5' 
                      : 'bg-background border-border hover:border-accent/30'
                  }`}
                >
                  <span className={`text-lg font-black ${hasMeeting ? 'text-accent' : 'text-primary'}`}>{day}</span>
                  {hasMeeting && (
                    <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent),0.5)]" />
                  )}
                  <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/5 transition-colors rounded-[1.5rem]" />
                </motion.div>
              );
            })}
          </div>
          
          <div className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-primary">Upcoming Today</h3>
              <div className="h-px flex-1 bg-border mx-8 hidden md:block" />
              <span className="text-xs font-black text-accent uppercase tracking-widest">April 15, 2026</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scheduledMeetings.filter(m => m.scheduledAt && m.scheduledAt.toDate().getDate() === 15).map(meeting => (
                <motion.div 
                  key={meeting.id} 
                  whileHover={{ x: 8 }}
                  className="flex items-center justify-between p-6 bg-surface rounded-[2rem] border border-border transition-all hover:border-accent hover:shadow-xl hover:shadow-accent/5"
                >
                  <div className="flex items-center space-x-5">
                    <div className="p-4 bg-background rounded-2xl shadow-sm text-accent">
                      <Video size={24} />
                    </div>
                    <div>
                      <p className="font-black text-lg text-primary">{meeting.title}</p>
                      <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">
                        {format(meeting.scheduledAt.toDate(), 'HH:mm')} - {format(meeting.scheduledAt.toDate(), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                    className="px-8 py-3 bg-accent text-white rounded-2xl text-xs font-black hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                  >
                    Join
                  </button>
                </motion.div>
              ))}
              {scheduledMeetings.filter(m => m.scheduledAt && m.scheduledAt.toDate().getDate() === 15).length === 0 && (
                <div className="col-span-full p-10 bg-surface rounded-[2rem] border border-dashed border-border text-center">
                  <p className="text-secondary font-bold italic">No meetings scheduled for today. Take a break!</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Create Meeting Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold">New Meeting</h2>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-3 hover:bg-surface rounded-2xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateMeeting} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-secondary ml-1">Meeting Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly Sync, Design Review"
                    value={newMeetingTitle}
                    onChange={(e) => setNewMeetingTitle(e.target.value)}
                    className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border">
                  <div className="flex items-center space-x-3">
                    <Calendar size={20} className="text-accent" />
                    <span className="text-sm font-bold">Schedule for later</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScheduled(!isScheduled)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isScheduled ? 'bg-accent' : 'bg-zinc-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-background rounded-full transition-all ${isScheduled ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {isScheduled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-secondary ml-1">Date</label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                            required={isScheduled}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-secondary ml-1">Time</label>
                          <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
                            required={isScheduled}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface rounded-2xl border border-border">
                    <Video size={20} className="text-accent mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Video</p>
                    <p className="text-xs font-medium">Enabled</p>
                  </div>
                  <div className="p-4 bg-surface rounded-2xl border border-border">
                    <Users size={20} className="text-blue-500 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Privacy</p>
                    <p className="text-xs font-medium">Public</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating || !newMeetingTitle.trim() || (isScheduled && (!scheduledDate || !scheduledTime))}
                  className="w-full py-5 bg-accent text-white rounded-2xl font-bold text-lg hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50 active:scale-95"
                >
                  {creating ? 'Creating...' : isScheduled ? 'Schedule Meeting' : 'Start Meeting'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
