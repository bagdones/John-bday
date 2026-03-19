/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ErrorInfo, ReactNode, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cake, ChevronRight, ChevronLeft, Heart, Upload, Image as ImageIcon, Leaf, Monitor, List, Download, X, Star, LogIn, LogOut } from 'lucide-react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  query, 
  orderBy, 
  getDocs,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse((this.state.error as any)?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "You don't have permission to perform this action. Please log in as an admin.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-vintage-beige text-vintage-brown font-serif">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-2xl italic">Application Error</h2>
            <p className="text-sm opacity-70">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-vintage-brown text-vintage-beige text-xs uppercase tracking-widest"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

type Page = 'landing' | 'timeline' | 'final';
type ViewMode = 'slideshow' | 'scroll';

interface TimelineStop {
  id: number;
  image: string;
  description: string;
  title: string;
  isMilestone?: boolean;
  order: number;
}

const DEFAULT_TIMELINE_STOPS: TimelineStop[] = [
  {
    id: 1,
    title: "The Beginning",
    image: "https://picsum.photos/seed/genshin_adventure/800/600",
    description: "One random Tuesday. One 'Request to Join.' One world that changed Jury’s life forever. Sometimes the best adventures start with a single click.",
    order: 1
  },
  {
    id: 2,
    title: "Shared Grinds",
    image: "https://picsum.photos/seed/vintage2/800/600",
    description: "Day by day, we grew closer. Beyond the shared laughter and the shared pain, there were the hours spent gathering boss materials just to level up. We might not spend our days hunting world bosses like we used to, but those shared grinds are leveled up to a permanent place in my heart.",
    order: 2
  },
  {
    id: 3,
    title: "Finding Our Way Back",
    image: "https://picsum.photos/seed/vintage3/800/600",
    description: "Even when things got tough, we found our way back to each other, doesn't matter how or why, but we ended up going back and honestly thats one of the few things I'm grateful for",
    order: 3
  },
  {
    id: 4,
    title: "Growing Together",
    image: "https://picsum.photos/seed/vintage4/800/600",
    description: "As life went by, we saw each other's small and big victories, we saw each other cry and crumble and we saw each other grow. Seeing you grow is one of life's best blessings for sure",
    order: 4
  },
  {
    id: 5,
    title: "Grateful Forever",
    image: "https://picsum.photos/seed/vintage5/800/600",
    description: "Looking back at how far we've come..I cant believe how much time has passed, Im grateful for you yesterday, grateful for you today ans grateful for you forever",
    order: 5
  }
];

const BackgroundDecor = () => {
  const leaves = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 10}s`,
    duration: `${10 + Math.random() * 15}s`,
    size: 12 + Math.random() * 24,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Background Lines */}
      <div className="absolute inset-0 bg-lines opacity-50" />
      
      {/* Falling Leaves */}
      {leaves.map((leaf) => (
        <motion.div
          key={leaf.id}
          className="absolute text-vintage-brown/20"
          style={{
            left: leaf.left,
            top: '-5vh',
          }}
          animate={{
            y: ['0vh', '110vh'],
            x: [0, Math.sin(leaf.id) * 50, 0],
            rotate: [leaf.rotation, leaf.rotation + 360],
          }}
          transition={{
            duration: parseFloat(leaf.duration),
            repeat: Infinity,
            delay: parseFloat(leaf.delay),
            ease: "linear"
          }}
        >
          <Leaf size={leaf.size} />
        </motion.div>
      ))}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <BirthdayApp />
    </ErrorBoundary>
  );
}

function BirthdayApp() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [currentStop, setCurrentStop] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('slideshow');
  const [isPresentation, setIsPresentation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [timelineStops, setTimelineStops] = useState<TimelineStop[]>(DEFAULT_TIMELINE_STOPS);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      // Check if user is the admin (juryhyasat59@gmail.com)
      if (currentUser?.email === "juryhyasat59@gmail.com") {
        if (currentUser?.emailVerified) {
          setIsAdmin(true);
        } else {
          console.warn("Admin user detected but email is not verified. Admin privileges disabled.");
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'timeline'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Initial setup if database is empty - check localStorage first
        const saved = localStorage.getItem('birthday_timeline_stops');
        if (saved) {
          try {
            const localStops = JSON.parse(saved);
            if (localStops && localStops.length > 0) {
              setTimelineStops(localStops);
              // If we are admin, we can also push them to Firestore automatically
              if (isAdmin) {
                for (const stop of localStops) {
                  await setDoc(doc(db, 'timeline', stop.id.toString()), {
                    ...stop,
                    updatedAt: new Date().toISOString(),
                    order: stop.id
                  });
                }
                console.log("Migrated data to Firestore");
              }
              return;
            }
          } catch (e) {
            console.error("Migration failed:", e);
          }
        }
        setTimelineStops(DEFAULT_TIMELINE_STOPS);
      } else {
        const stops = snapshot.docs.map(doc => doc.data() as TimelineStop);
        setTimelineStops(stops);
      }
    }, (err) => {
      if (err.message.includes("insufficient permissions")) {
        // Public read is allowed, so this shouldn't happen unless rules are wrong
        console.warn("Firestore permissions issue:", err);
      } else {
        handleFirestoreError(err, OperationType.LIST, 'timeline');
      }
    });

    return () => unsubscribe();
  }, [isAuthReady, isAdmin]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
      setError("Login failed. Please try again.");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const exportToImage = async () => {
    if (!timelineRef.current) return;
    try {
      const canvas = await html2canvas(timelineRef.current, {
        useCORS: true,
        backgroundColor: '#f5f2ed',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `birthday-timeline-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to export image. Please try again.");
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('birthday_timeline_stops', JSON.stringify(timelineStops));
    } catch (e) {
      console.error("Failed to save timeline stops to localStorage:", e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        setError("Storage limit reached. Try using a smaller image file.");
      }
    }
  }, [timelineStops]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-vintage-beige text-vintage-brown font-serif">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-2xl italic">Storage Error</h2>
          <p className="text-sm opacity-70">{error}</p>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setError(null)}
              className="px-6 py-2 border border-vintage-brown text-vintage-brown text-xs uppercase tracking-widest"
            >
              Dismiss
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('birthday_timeline_stops');
                window.location.reload();
              }}
              className="px-6 py-2 bg-vintage-brown text-vintage-beige text-xs uppercase tracking-widest"
            >
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, stopId: number) => {
    if (!isAdmin) {
      setError("Only the admin can upload images.");
      return;
    }

    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const compressed = await compressImage(base64String);
        
        const stopToUpdate = timelineStops.find(s => s.id === stopId);
        if (stopToUpdate) {
          try {
            const path = `timeline/${stopId}`;
            await setDoc(doc(db, 'timeline', stopId.toString()), {
              ...stopToUpdate,
              image: compressed,
              updatedAt: Timestamp.now().toDate().toISOString(),
              order: stopId // Assuming ID is order for simplicity
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `timeline/${stopId}`);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addNewStop = async () => {
    if (!isAdmin) return;
    const newId = timelineStops.length > 0 ? Math.max(...timelineStops.map(s => s.id)) + 1 : 1;
    const newStop: TimelineStop = {
      id: newId,
      title: "New Memory",
      image: "https://picsum.photos/seed/new/800/600",
      description: "Click the icons to edit this memory.",
      order: newId
    };
    
    try {
      await setDoc(doc(db, 'timeline', newId.toString()), {
        ...newStop,
        updatedAt: Timestamp.now().toDate().toISOString()
      });
      setCurrentStop(timelineStops.length);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `timeline/${newId}`);
    }
  };

  const deleteStop = async (stopId: number) => {
    if (!isAdmin || !window.confirm("Are you sure you want to delete this memory?")) return;
    try {
      await deleteDoc(doc(db, 'timeline', stopId.toString()));
      if (currentStop > 0) setCurrentStop(prev => prev - 1);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `timeline/${stopId}`);
    }
  };

  const updateStopText = async (stopId: number, field: 'title' | 'description', value: string) => {
    if (!isAdmin) return;
    const stop = timelineStops.find(s => s.id === stopId);
    if (!stop) return;

    try {
      await setDoc(doc(db, 'timeline', stopId.toString()), {
        ...stop,
        [field]: value,
        updatedAt: Timestamp.now().toDate().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `timeline/${stopId}`);
    }
  };

  const nextStop = () => {
    if (currentStop < timelineStops.length - 1) {
      setCurrentStop(prev => prev + 1);
    } else {
      setCurrentPage('final');
    }
  };

  const prevStop = () => {
    if (currentStop > 0) {
      setCurrentStop(prev => prev - 1);
    }
  };

  const downloadAllImages = async () => {
    const zip = new JSZip();
    const folder = zip.folder("birthday-memories");
    
    if (!folder) return;

    const promises = timelineStops.map(async (stop, index) => {
      try {
        let blob: Blob;
        if (stop.image.startsWith('data:')) {
          // Base64
          const response = await fetch(stop.image);
          blob = await response.blob();
        } else {
          // URL
          const response = await fetch(stop.image);
          blob = await response.blob();
        }
        const extension = blob.type.split('/')[1] || 'jpg';
        folder.file(`${index + 1}-${stop.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`, blob);
      } catch (err) {
        console.error(`Failed to download image ${index + 1}:`, err);
      }
    });

    await Promise.all(promises);
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `birthday-memories-${new Date().getTime()}.zip`);
  };

  const syncToCloud = async () => {
    if (!isAdmin) return;
    const saved = localStorage.getItem('birthday_timeline_stops');
    if (saved) {
      try {
        const localStops = JSON.parse(saved);
        for (const stop of localStops) {
          await setDoc(doc(db, 'timeline', stop.id.toString()), {
            ...stop,
            updatedAt: new Date().toISOString(),
            order: stop.id
          });
        }
        alert("Successfully synced local images to the cloud!");
      } catch (e) {
        console.error("Sync failed:", e);
        alert("Failed to sync images: " + (e instanceof Error ? e.message : String(e)));
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden vintage-paper relative">
      {/* Decorative border */}
      <div className="fixed inset-4 border border-vintage-brown/20 pointer-events-none z-50" />
      <div className="fixed inset-6 border border-vintage-brown/10 pointer-events-none z-50" />

      <AnimatePresence mode="wait">
        {currentPage === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center px-6 max-w-4xl cursor-pointer group z-10"
            onClick={() => setCurrentPage('timeline')}
          >
            <BackgroundDecor />
            <motion.h1 
              className="text-4xl md:text-6xl lg:text-7xl font-serif leading-tight mb-8 italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1.5 }}
            >
              "A small space on the internet for a person who takes up a big space in my heart."
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
              className="flex flex-col items-center gap-2 text-vintage-brown/60"
            >
              <span className="text-sm uppercase tracking-[0.3em] font-sans">Click to enter</span>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <ChevronRight className="w-6 h-6 rotate-90" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {currentPage === 'timeline' && (
          <div className="w-full h-full flex flex-col items-center relative">
            {/* Top Controls */}
            {!isPresentation && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed top-8 right-8 flex gap-4 z-[60]"
              >
                {isAdmin && (
                  <button
                    onClick={addNewStop}
                    className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                    title="Add New Memory"
                  >
                    <X size={20} className="rotate-45" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={syncToCloud}
                    className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                    title="Save All to Cloud"
                  >
                    <Upload size={20} className="rotate-180" />
                  </button>
                )}
                <button
                  onClick={downloadAllImages}
                  className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                  title="Download All Images (.zip)"
                >
                  <ImageIcon size={20} />
                </button>
                {isAdmin ? (
                  <button
                    onClick={logout}
                    className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                    title="Logout Admin"
                  >
                    <LogOut size={20} />
                  </button>
                ) : (
                  <button
                    onClick={login}
                    className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                    title="Admin Login"
                  >
                    <LogIn size={20} />
                  </button>
                )}
                <button
                  onClick={() => setViewMode(prev => prev === 'slideshow' ? 'scroll' : 'slideshow')}
                  className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                  title={viewMode === 'slideshow' ? "Switch to Scroll View" : "Switch to Slideshow View"}
                >
                  {viewMode === 'slideshow' ? <List size={20} /> : <Monitor size={20} />}
                </button>
                <button
                  onClick={exportToImage}
                  className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                  title="Export to Image"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={() => setIsPresentation(true)}
                  className="p-3 bg-white/80 backdrop-blur-sm border border-vintage-brown/20 text-vintage-brown hover:bg-vintage-brown hover:text-vintage-beige transition-all rounded-full shadow-lg"
                  title="Presentation Mode"
                >
                  <Monitor size={20} />
                </button>
              </motion.div>
            )}

            {isPresentation && (
              <button
                onClick={() => setIsPresentation(false)}
                className="fixed top-8 right-8 p-3 bg-black/50 text-white hover:bg-black/70 transition-all rounded-full z-[100]"
              >
                <X size={24} />
              </button>
            )}

            {viewMode === 'slideshow' ? (
              <motion.div
                key="slideshow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`w-full h-full flex flex-col items-center justify-center px-4 transition-all duration-700 ${isPresentation ? 'slideshow-overlay' : ''}`}
              >
                <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <motion.div 
                    key={`img-${currentStop}`}
                    initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    className={`relative aspect-[4/3] w-full shadow-2xl sepia-filter border-[12px] border-white group/img ${timelineStops[currentStop].isMilestone ? 'milestone-highlight' : ''}`}
                  >
                    <img 
                      src={timelineStops[currentStop].image} 
                      alt={timelineStops[currentStop].title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    
                    {!isPresentation && isAdmin && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md p-4 rounded-full transition-all border border-white/30" title="Change Photo">
                          <Upload className="w-6 h-6 text-white" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, timelineStops[currentStop].id)}
                          />
                        </label>
                        <button 
                          onClick={() => deleteStop(timelineStops[currentStop].id)}
                          className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md p-4 rounded-full transition-all border border-red-500/30"
                          title="Delete Memory"
                        >
                          <X className="w-6 h-6 text-white" />
                        </button>
                      </div>
                    )}

                    {timelineStops[currentStop].isMilestone && (
                      <div className="absolute -top-6 -left-6 bg-vintage-accent text-white p-3 rounded-full shadow-lg animate-pulse">
                        <Star className="w-6 h-6 fill-white" />
                      </div>
                    )}

                    <div className="absolute -bottom-4 -right-4 bg-vintage-brown text-vintage-beige px-4 py-2 font-serif italic text-lg">
                      {currentStop + 1} / {timelineStops.length}
                    </div>
                  </motion.div>

                  <div className="flex flex-col gap-6">
                    <motion.div
                      key={`text-${currentStop}`}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col gap-4"
                    >
                      <h2 className="text-3xl md:text-5xl font-serif text-vintage-brown flex items-center gap-4 group/title relative">
                        {timelineStops[currentStop].title}
                        {timelineStops[currentStop].isMilestone && <span className="text-sm uppercase tracking-widest font-sans text-vintage-accent">Milestone</span>}
                        {!isPresentation && isAdmin && (
                          <button 
                            onClick={() => {
                              const val = window.prompt("Edit Title:", timelineStops[currentStop].title);
                              if (val !== null) updateStopText(timelineStops[currentStop].id, 'title', val);
                            }}
                            className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 text-vintage-brown/40 hover:text-vintage-accent"
                            title="Edit Title"
                          >
                            <Upload size={16} className="rotate-90" />
                          </button>
                        )}
                      </h2>
                      <div className="w-20 h-px bg-vintage-brown/30" />
                      <div className="group/desc relative">
                        <p className="text-lg md:text-xl leading-relaxed text-vintage-brown/80 font-serif italic">
                          {timelineStops[currentStop].description}
                        </p>
                        {!isPresentation && isAdmin && (
                          <button 
                            onClick={() => {
                              const val = window.prompt("Edit Description:", timelineStops[currentStop].description);
                              if (val !== null) updateStopText(timelineStops[currentStop].id, 'description', val);
                            }}
                            className="absolute -right-8 top-0 opacity-0 group-hover/desc:opacity-100 transition-opacity p-1 text-vintage-brown/40 hover:text-vintage-accent"
                            title="Edit Description"
                          >
                            <Upload size={16} className="rotate-90" />
                          </button>
                        )}
                      </div>
                    </motion.div>

                    <div className="flex gap-4 mt-8">
                      <button
                        onClick={prevStop}
                        disabled={currentStop === 0}
                        className={`p-4 rounded-full border border-vintage-brown/20 transition-all ${
                          currentStop === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-vintage-brown hover:text-vintage-beige'
                        }`}
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={nextStop}
                        className="flex-1 flex items-center justify-between px-8 py-4 bg-vintage-brown text-vintage-beige hover:bg-vintage-accent transition-all group"
                      >
                        <span className="font-sans uppercase tracking-widest text-sm font-semibold">
                          {currentStop === timelineStops.length - 1 ? "Final Message" : "Next Memory"}
                        </span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timeline progress indicator */}
                <div className="absolute bottom-12 flex gap-3">
                  {timelineStops.map((_, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setCurrentStop(idx)}
                      className={`h-1.5 transition-all duration-500 rounded-full ${
                        idx === currentStop ? 'w-12 bg-vintage-brown' : 'w-3 bg-vintage-brown/20 hover:bg-vintage-brown/40'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="scroll"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-screen overflow-y-auto overflow-x-hidden pt-32 pb-64 px-6 scroll-smooth"
                ref={timelineRef}
              >
                <div className="max-w-4xl mx-auto space-y-32">
                  {timelineStops.map((stop, idx) => (
                    <motion.div
                      key={stop.id}
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                    >
                      <div className={`relative aspect-[4/3] w-full shadow-xl border-[8px] border-white sepia-filter ${stop.isMilestone ? 'milestone-highlight' : ''} ${idx % 2 === 1 ? 'md:order-2' : ''}`}>
                        <img src={stop.image} alt={stop.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute -bottom-4 -right-4 bg-vintage-brown text-vintage-beige px-3 py-1 text-sm font-serif italic">
                          {idx + 1}
                        </div>
                      </div>
                      <div className={`space-y-4 ${idx % 2 === 1 ? 'md:order-1 md:text-right' : ''}`}>
                        <h3 className="text-3xl font-serif text-vintage-brown">{stop.title}</h3>
                        <div className={`w-12 h-px bg-vintage-brown/30 ${idx % 2 === 1 ? 'ml-auto' : ''}`} />
                        <p className="text-lg font-serif italic text-vintage-brown/80 leading-relaxed">
                          {stop.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="pt-20 flex justify-center"
                  >
                    <button
                      onClick={() => setCurrentPage('final')}
                      className="px-12 py-4 bg-vintage-brown text-vintage-beige font-sans uppercase tracking-[0.3em] text-sm hover:bg-vintage-accent transition-all"
                    >
                      Read Final Message
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {currentPage === 'final' && (
          <motion.div
            key="final"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="max-w-3xl w-full px-6 py-12 flex flex-col items-center text-center z-10"
          >
            <BackgroundDecor />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-8 mb-16 text-lg md:text-xl leading-relaxed font-serif italic text-vintage-brown/90"
            >
              <p>
                There are so many things I could say, but words often feel like they fall short when it comes to a friendship like ours. You've been the person who knows the silence between my thoughts and the laughter behind my jokes.
              </p>
              <p>
                Watching you grow, evolve, and navigate this messy thing we call life has been one of my greatest privileges. You carry a strength that you don't always see, and a kindness that changes the room the moment you walk in.
              </p>
              <p>
                I hope you know that your presence is a gift to everyone lucky enough to know you. You make the world feel a little softer, a little brighter, and a lot more meaningful just by being exactly who you are.
              </p>
              <p>
                As you step into another year, my wish for you is simple but deep. I wish for you the kind of happiness that makes your eyes crinkle and your heart feel full. I wish for you peace in the quiet moments and excitement in the loud ones.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2, type: "spring", stiffness: 100 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative">
                <Cake className="w-16 h-16 text-vintage-brown" />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute -top-2 -right-2"
                >
                  <Heart className="w-6 h-6 text-vintage-accent fill-vintage-accent" />
                </motion.div>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-serif italic leading-relaxed max-w-xl">
                "happy birthday to the person who still hasn't figured out how to be an adult, and i still love him for it. May this year be the year you actually get to live.. Not just survive"
              </h2>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 4 }}
                onClick={() => {
                  setCurrentPage('landing');
                  setCurrentStop(0);
                }}
                className="mt-8 text-xs uppercase tracking-[0.4em] text-vintage-brown/40 hover:text-vintage-brown transition-colors"
              >
                Start Over
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
