// ... (imports remain the same, ensure all necessary icons are imported)
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Trophy, Calendar, Users, Shield, Star, LogOut,
  ChevronRight, Plus, Save, Trash2, Award, Activity, Lock,
  User as UserIcon, Settings, List, UserPlus, Filter, X, Bell, Mail, Info, CheckCheck, Home, LayoutDashboard
} from 'lucide-react';
import { auth, db } from './src/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc, query, where } from 'firebase/firestore';

// --- CONSTANTS ---
const LOGO_URL = "/logo.png";

const TEAM_COLORS = [
  'bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-yellow-500',
  'bg-purple-600', 'bg-pink-500', 'bg-indigo-600', 'bg-orange-500',
  'bg-cyan-600', 'bg-slate-800', 'bg-emerald-500', 'bg-rose-500'
];

// --- TYPES ---
// ... (Previous types remain)

type Role = 'owner' | 'manager' | 'captain' | 'player';
type Category = 'MASCULINO' | 'FEMENINO_A' | 'FEMENINO_B';
type ViewState = 'home' | 'matches' | 'standings' | 'team' | 'profile' | 'notifications' | 'team_detail' | 'admin';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  teamId?: string; // If captain or player
}

interface Player {
  id: string;
  name: string;
  number: number;
  teamId: string;
  goals: number;
}

interface Team {
  id: string;
  name: string;
  category: Category;
  logoColor: string;
}

interface Round {
  id: string;
  name: string; // "Fecha 1", "4tos de Final"
  date?: string; // Optional reference date, ISO string
}

interface MatchStats {
  homeScore: number;
  awayScore: number;
  scorers: { playerId: string; count: number }[];
  mvpPlayerId?: string;
  summary?: string;
  isPlayed: boolean;
}

interface Match {
  id: string;
  roundId: string;
  matchDay: number; // Deprecated, keep for now or use as index
  date: string;
  category: Category;
  homeTeamId: string;
  awayTeamId: string;
  stats: MatchStats;
}

interface Notification {
  id: string;
  userId: string | 'all'; // 'all' for broadcast
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}

// --- MOCK DATA INITIALIZER ---
// ... (Previous Mock Data remains, keeping it for init)
const INITIAL_TEAMS: Team[] = [
  { id: 't1', name: 'Los Rayos', category: 'MASCULINO', logoColor: 'bg-blue-600' },
  { id: 't2', name: 'Halcones', category: 'MASCULINO', logoColor: 'bg-red-600' },
  { id: 't3', name: 'Guerreras', category: 'FEMENINO_A', logoColor: 'bg-purple-600' },
  { id: 't4', name: 'Amazonas', category: 'FEMENINO_A', logoColor: 'bg-green-600' },
  { id: 't5', name: 'Estrellas', category: 'FEMENINO_B', logoColor: 'bg-yellow-500' },
  { id: 't6', name: 'Cometas', category: 'FEMENINO_B', logoColor: 'bg-pink-500' },
];

const INITIAL_ROUNDS: Round[] = [
  { id: 'r1', name: 'Fecha 1' }
];

const INITIAL_MATCHES: Match[] = [
  {
    id: 'm1',
    roundId: 'r1',
    matchDay: 1,
    date: '2023-11-10T18:00',
    category: 'MASCULINO',
    homeTeamId: 't1',
    awayTeamId: 't2',
    stats: { homeScore: 2, awayScore: 1, scorers: [], isPlayed: true }
  },
  {
    id: 'm2',
    roundId: 'r1',
    matchDay: 1,
    date: '2023-11-10T19:30',
    category: 'FEMENINO_A',
    homeTeamId: 't3',
    awayTeamId: 't4',
    stats: { homeScore: 0, awayScore: 0, scorers: [], isPlayed: false }
  },
  {
    id: 'm3',
    roundId: 'r1',
    matchDay: 1,
    date: '2023-11-11T16:00',
    category: 'FEMENINO_B',
    homeTeamId: 't5',
    awayTeamId: 't6',
    stats: { homeScore: 0, awayScore: 0, scorers: [], isPlayed: false }
  },
];

const INITIAL_USERS: User[] = [
  { id: 'u1', email: 'admin@torneo.com', name: 'Admin', role: 'owner' },
  { id: 'u2', email: 'encargado@torneo.com', name: 'Mesa', role: 'manager' },
  { id: 'u3', email: 'capitan@rayos.com', name: 'Capitán', role: 'captain', teamId: 't1' },
];

const INITIAL_PLAYERS: Player[] = [
  { id: 'p1', name: 'Juan Perez', number: 10, teamId: 't1', goals: 0 },
  { id: 'p2', name: 'Pedro Gomez', number: 9, teamId: 't1', goals: 0 },
  { id: 'p3', name: 'Maria Rodriguez', number: 5, teamId: 't3', goals: 0 },
];

// --- CONTEXT ---

interface AppContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
  users: User[];
  teams: Team[];
  matches: Match[];
  players: Player[];
  notifications: Notification[];
  updateMatch: (matchId: string, stats: MatchStats) => Promise<void>;
  updateUserRole: (userId: string, role: Role, teamId?: string) => void;
  addPlayer: (name: string, number: number, teamId: string) => void;
  removePlayer: (playerId: string) => void;
  selectedCategory: Category;
  setSelectedCategory: (c: Category) => void;
  addTeam: (name: string, category: Category, logoColor: string) => void;
  deleteTeam: (teamId: string) => void;
  deleteMatch: (matchId: string) => void;
  sendNotification: (userId: string | 'all', title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
  markAsRead: (notificationId: string) => void;
  activeView: ViewState;
  setActiveView: (view: ViewState) => void;
  selectedTeamId: string | null;
  selectTeam: (teamId: string) => void;
  rounds: Round[];
  addRound: (name: string, date?: string) => Promise<string>; // Returns the new ID
  deleteRound: (roundId: string) => void;
  addMatch: (roundId: string, date: string, category: Category, homeTeamId: string, awayTeamId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const [activeView, setActiveView] = useState<ViewState>('home');

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>('MASCULINO');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);

  const selectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setActiveView('team_detail');
  };

  // Firebase Auth Listener
  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user data from Firestore
        unsubUser = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = { id: docSnapshot.id, ...docSnapshot.data() } as User;
            setUser(userData);

            // Enforce Owner Role for specific email
            if (userData.email === 'test@lamasia.com' && userData.role !== 'owner') {
              updateDoc(doc(db, "users", firebaseUser.uid), { role: 'owner' })
                .then(() => console.log("Auto-upgraded user to owner"));
            }
          } else {
            // User exists in Auth but not in Firestore (should fix inconsistency)
            // We can create a default profile or logout.
            // For now, let's create a default profile to fix the "locked out" issue
            const newUser = { email: firebaseUser.email || '', name: firebaseUser.displayName || 'Usuario', role: 'player' };
            setDoc(doc(db, "users", firebaseUser.uid), newUser).then(() => {
              console.log("Recovered missing user profile");
            });
          }
        }, (error) => {
          console.error("Error fetching user data:", error);
        });
      } else {
        if (unsubUser) unsubUser();
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Data Listeners
  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
      setTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });
    const unsubMatches = onSnapshot(collection(db, "matches"), (snapshot) => {
      setMatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    });
    const unsubPlayers = onSnapshot(collection(db, "players"), (snapshot) => {
      setPlayers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    });
    const unsubNotifs = onSnapshot(collection(db, "notifications"), (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    const unsubRounds = onSnapshot(collection(db, "rounds"), (snapshot) => {
      setRounds(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Round)));
    });
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
    return () => {
      unsubTeams();
      unsubMatches();
      unsubPlayers();
      unsubNotifs();
      unsubRounds();
      unsubUsers();
    };
  }, []);

  // Reset view on login/logout
  useEffect(() => {
    setActiveView('home');
  }, [user]);

  // Request notification permission on load
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = async (userId: string | 'all', title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const newNotif = {
      userId,
      title,
      message,
      date: new Date().toISOString(),
      read: false,
      type
    };
    await addDoc(collection(db, "notifications"), newNotif);

    if ("Notification" in window && Notification.permission === "granted") {
      if (userId === 'all' || (user && user.id === userId)) {
        new Notification(title, { body: message, icon: LOGO_URL });
      }
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      console.error("Login Error:", e);
      alert('Error en inicio de sesión: ' + e.message);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // create user doc
      const role = email === 'test@lamasia.com' ? 'owner' : 'player';
      const newUser = { email, name, role };
      await setDoc(doc(db, "users", cred.user.uid), newUser);
      await sendNotification(cred.user.uid, 'Registro Exitoso', `Bienvenido ${role === 'owner' ? 'Propietario' : ''}.`);
    } catch (e: any) {
      alert('Error en registro: ' + e.message);
    }
  };

  const logout = () => {
    signOut(auth);
    setActiveView('home');
  };

  const updateMatch = async (matchId: string, stats: MatchStats) => {
    const updatedStats = { ...stats, summary: undefined };
    await updateDoc(doc(db, "matches", matchId), { stats: updatedStats });

    // Notify all users about match result
    if (stats.isPlayed) {
      const match = matches.find(m => m.id === matchId);
      const home = teams.find(t => t.id === match?.homeTeamId);
      const away = teams.find(t => t.id === match?.awayTeamId);
      if (home && away) {
        sendNotification('all', 'Resultado Final', `${home.name} (${stats.homeScore}) - (${stats.awayScore}) ${away.name}`, 'success');
      }
    }
  };

  const updateUserRole = async (userId: string, role: Role, teamId?: string) => {
    const data: any = { role };
    if (teamId !== undefined) data.teamId = teamId;
    await updateDoc(doc(db, "users", userId), data);

    const u = users.find(us => us.id === userId);
    if (u) {
      sendNotification(userId, 'Rol Actualizado', `Tu rol ha sido actualizado a ${role.toUpperCase()}.`, 'warning');
    }
  };

  const addPlayer = async (name: string, number: number, teamId: string) => {
    const newPlayer = {
      name,
      number,
      teamId,
      goals: 0
    };
    await addDoc(collection(db, "players"), newPlayer);
  };

  const removePlayer = async (playerId: string) => {
    await deleteDoc(doc(db, "players", playerId));
  };

  const addTeam = async (name: string, category: Category, logoColor: string) => {
    try {
      const newTeam = {
        name,
        category,
        logoColor
      };
      await addDoc(collection(db, "teams"), newTeam);
      await sendNotification('all', 'Nuevo Equipo', `Se ha inscrito el equipo ${name} en ${category.replace('_', ' ')}`);
    } catch (e: any) {
      console.error("Error adding team: ", e);
      alert("Error al crear equipo: " + e.message);
    }
  };

  const deleteTeam = async (teamId: string) => {
    await deleteDoc(doc(db, "teams", teamId));
  };

  const addRound = async (name: string, date?: string) => {
    const docRef = await addDoc(collection(db, "rounds"), { name, date: date || '' });
    return docRef.id;
  };

  const deleteRound = async (roundId: string) => {
    // Optionally delete matches associated with this round
    const roundMatches = matches.filter(m => m.roundId === roundId);
    for (const m of roundMatches) {
      await deleteDoc(doc(db, "matches", m.id));
    }
    await deleteDoc(doc(db, "rounds", roundId));
  };

  const addMatch = async (roundId: string, date: string, category: Category, homeTeamId: string, awayTeamId: string) => {
    const newMatch = {
      roundId,
      matchDay: 0, // Deprecated but kept for compatibility if needed
      date,
      category,
      homeTeamId,
      awayTeamId,
      stats: { homeScore: 0, awayScore: 0, scorers: [], isPlayed: false }
    };
    await addDoc(collection(db, "matches"), newMatch);
  };

  const deleteMatch = async (matchId: string) => {
    await deleteDoc(doc(db, "matches", matchId));
  };

  const markAsRead = async (notificationId: string) => {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
  };

  return (
    <AppContext.Provider value={{
      user, login, logout, register,
      users, teams, matches, players, notifications,
      updateMatch, updateUserRole, addPlayer, removePlayer,
      selectedCategory, setSelectedCategory,
      addTeam, deleteTeam, addMatch, deleteMatch,
      sendNotification, markAsRead,
      activeView, setActiveView,
      selectedTeamId, selectTeam,
      rounds, addRound, deleteRound
    }}>
      {children}
    </AppContext.Provider>
  );
};

// ... (useAppContext remains the same)
const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

// --- COMPONENTS ---

const Header = () => {
  const { user, notifications, activeView, setActiveView } = useAppContext();

  const unreadCount = notifications.filter(n => (n.userId === 'all' || n.userId === user?.id) && !n.read).length;

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center space-x-3" onClick={() => setActiveView('home')}>
          <img src={LOGO_URL} alt="La Masía F&C Logo" className="w-9 h-9 rounded-full object-cover border border-slate-700 shadow-glow" />
          <span className="font-bold text-lg tracking-tight">LA MASÍA F&C</span>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <button
              onClick={() => setActiveView('notifications')}
              className={`relative transition-colors ${activeView === 'notifications' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Bell size={22} className={activeView === 'notifications' ? 'fill-current' : ''} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">{unreadCount}</span>
              )}
            </button>

            {/* Profile Avatar */}
            <button
              onClick={() => setActiveView('profile')}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all overflow-hidden ${activeView === 'profile' ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'border-slate-600 hover:border-slate-400'}`}
            >
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-200">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const CategoryTabs = () => {
  const { selectedCategory, setSelectedCategory, activeView } = useAppContext();

  // Hide category tabs on home, team detail, profile, or notifications to reduce clutter
  if (['home', 'team', 'team_detail', 'profile', 'notifications'].includes(activeView)) return null;

  return (
    <div className="bg-white border-b sticky top-14 z-40">
      <div className="flex p-3 space-x-2 overflow-x-auto scrollbar-hide">
        {(['MASCULINO', 'FEMENINO_A', 'FEMENINO_B'] as Category[]).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm flex-shrink-0 ${selectedCategory === cat ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  );
};

const BottomNavigation = () => {
  const { activeView, setActiveView, user } = useAppContext();

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'matches', icon: Calendar, label: 'Partidos' },
    { id: 'standings', icon: List, label: 'Tabla' },
    ...(user && (user.role === 'owner' || user.role === 'manager')
      ? [{ id: 'admin', icon: Settings, label: 'Admin' }]
      : [{ id: 'team', icon: Shield, label: 'Mi Equipo' }])
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50 shadow-lg">
      <div className="flex justify-around items-center h-16">
        {navItems.map(item => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as ViewState)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const NotificationsView = () => {
  const { user, notifications, markAsRead } = useAppContext();
  const myNotifications = notifications.filter(n => n.userId === 'all' || n.userId === user?.id);

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Bell size={18} className="text-slate-900" />
        <h2 className="font-bold text-slate-900 text-lg">Notificaciones</h2>
      </div>

      <div className="space-y-3">
        {myNotifications.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell size={32} className="opacity-20" />
            </div>
            <p className="text-sm font-medium">No tienes notificaciones</p>
          </div>
        )}
        {myNotifications.map(n => (
          <div
            key={n.id}
            onClick={() => markAsRead(n.id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${n.read ? 'bg-white border-slate-100 text-slate-500' : 'bg-white border-blue-200 shadow-md shadow-blue-50'}`}
          >
            {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
            <div className="flex justify-between items-start mb-1.5 pl-2">
              <h4 className={`font-bold text-sm ${n.read ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</h4>
              <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{new Date(n.date).toLocaleDateString()}</span>
            </div>
            <p className="text-xs leading-relaxed pl-2 text-slate-600">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ... (StandingsView, MatchesView, MatchEditorModal, TeamView remain largely the same, just ensuring they use activeView correctly implicitly)

const StandingsView = () => {
  const { teams, matches, selectedCategory, players, selectTeam } = useAppContext();
  const [activeTab, setActiveTab] = useState<'table' | 'scorers' | 'mvp'>('table');

  const standings = useMemo(() => {
    const categoryTeams = teams.filter(t => t.category === selectedCategory);
    const stats = categoryTeams.map(team => {
      let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, gc = 0;
      matches.filter(m => m.isPlayed && m.category === selectedCategory && (m.homeTeamId === team.id || m.awayTeamId === team.id)).forEach(m => {
        const isHome = m.homeTeamId === team.id;
        const myScore = isHome ? m.stats.homeScore : m.stats.awayScore;
        const oppScore = isHome ? m.stats.awayScore : m.stats.homeScore;
        played++; gf += myScore; gc += oppScore;
        if (myScore > oppScore) won++; else if (myScore < oppScore) lost++; else drawn++;
      });
      const points = (won * 3) + (drawn * 1);
      const diff = gf - gc;
      return { team, played, won, drawn, lost, gf, gc, diff, points };
    });
    return stats.sort((a, b) => b.points - a.points || b.diff - a.diff);
  }, [teams, matches, selectedCategory]);

  const scorers = useMemo(() => {
    const playerGoals: Record<string, number> = {};
    matches.filter(m => m.isPlayed && m.category === selectedCategory).forEach(m => {
      if (m.stats.scorers) {
        m.stats.scorers.forEach(s => {
          playerGoals[s.playerId] = (playerGoals[s.playerId] || 0) + s.count;
        });
      }
    });

    return Object.entries(playerGoals)
      .map(([playerId, count]) => {
        const player = players.find(p => p.id === playerId);
        const team = teams.find(t => t.id === player?.teamId);
        return { player, team, count };
      })
      .filter(stat => stat.player && stat.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [matches, selectedCategory, players, teams]);

  const mvps = useMemo(() => {
    const playerMvps: Record<string, number> = {};
    matches.filter(m => m.isPlayed && m.category === selectedCategory).forEach(m => {
      if (m.stats.mvpPlayerId) {
        playerMvps[m.stats.mvpPlayerId] = (playerMvps[m.stats.mvpPlayerId] || 0) + 1;
      }
    });

    return Object.entries(playerMvps)
      .map(([playerId, count]) => {
        const player = players.find(p => p.id === playerId);
        const team = teams.find(t => t.id === player?.teamId);
        return { player, team, count };
      })
      .filter(stat => stat.player && stat.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [matches, selectedCategory, players, teams]);

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Tabs */}
      <div className="flex p-1 bg-slate-200 rounded-lg">
        <button onClick={() => setActiveTab('table')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'table' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Clasificación</button>
        <button onClick={() => setActiveTab('scorers')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'scorers' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Goleadores</button>
        <button onClick={() => setActiveTab('mvp')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'mvp' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>MVP</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[300px]">
        <div className="p-3 bg-slate-50 border-b flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            {activeTab === 'table' && <><Activity size={16} className="text-emerald-600" /> Tabla de Posiciones</>}
            {activeTab === 'scorers' && <><Award size={16} className="text-yellow-500" /> Goleadores</>}
            {activeTab === 'mvp' && <><Star size={16} className="text-purple-500" /> Ranking MVP</>}
          </h2>
          <span className="text-xs text-slate-400 font-medium">{selectedCategory.replace('_', ' ')}</span>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'table' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2 w-8 text-center">#</th>
                  <th className="p-2">Equipo</th>
                  <th className="p-2 w-8 text-center">PJ</th>
                  <th className="p-2 w-8 text-center">DG</th>
                  <th className="p-2 w-10 text-center font-bold text-slate-800">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {standings.map((row, idx) => (
                  <tr key={row.team.id} onClick={() => selectTeam(row.team.id)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="p-2 text-center font-medium text-slate-400">{idx + 1}</td>
                    <td className="p-2 font-medium flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${row.team.logoColor} flex-shrink-0`}></div>
                      <span className="truncate max-w-[120px]">{row.team.name}</span>
                    </td>
                    <td className="p-2 text-center">{row.played}</td>
                    <td className="p-2 text-center text-slate-500">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                    <td className="p-2 text-center font-bold text-emerald-700 bg-emerald-50/50">{row.points}</td>
                  </tr>
                ))}
                {standings.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">Sin equipos</td></tr>}
              </tbody>
            </table>
          )}

          {(activeTab === 'scorers' || activeTab === 'mvp') && (
            <div className="divide-y">
              {(activeTab === 'scorers' ? scorers : mvps).map((stat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 flex items-center justify-center font-bold text-xs rounded-full 
                          ${idx === 0 ? 'bg-yellow-400 text-yellow-900 shadow-sm' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-600 text-amber-100' : 'text-slate-400 bg-slate-100'}`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{stat.player?.name}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${stat.team?.logoColor}`}></span>
                        {stat.team?.name}
                      </p>
                    </div>
                  </div>
                  <div className="font-black text-slate-800 text-sm bg-slate-100 px-2 py-1 rounded">
                    {stat.count} <span className="text-[8px] font-normal text-slate-400 uppercase tracking-wide">{activeTab === 'scorers' ? 'Goles' : 'MVPs'}</span>
                  </div>
                </div>
              ))}
              {(activeTab === 'scorers' ? scorers : mvps).length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No hay datos registrados aún
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MatchesView = () => {
  const { rounds, matches, teams, players, selectedCategory, user } = useAppContext();
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [filterRoundId, setFilterRoundId] = useState<string>('all');

  useEffect(() => { setFilterRoundId('all'); }, [selectedCategory]);

  const { groupedMatches, sortedRoundIds } = useMemo(() => {
    const categoryMatches = matches.filter(m => m.category === selectedCategory);
    const groups: Record<string, Match[]> = {};
    categoryMatches.forEach(m => {
      if (!groups[m.roundId]) groups[m.roundId] = [];
      groups[m.roundId].push(m);
    });

    // Sort rounds based on their order in the rounds array or by name
    const roundIds = Object.keys(groups).sort((a, b) => {
      const rA = rounds.find(r => r.id === a);
      const rB = rounds.find(r => r.id === b);
      return (rA?.name || '').localeCompare(rB?.name || '', undefined, { numeric: true });
    });

    return { groupedMatches: groups, sortedRoundIds: roundIds };
  }, [matches, selectedCategory, rounds]);

  const displayedRoundIds = filterRoundId === 'all' ? sortedRoundIds : sortedRoundIds.filter(id => id === filterRoundId);
  const canEdit = user && (user.role === 'owner' || user.role === 'manager');

  return (
    <div className="p-4 pb-24 space-y-4">
      {sortedRoundIds.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2">
          <button onClick={() => setFilterRoundId('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterRoundId === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Todos</button>
          {sortedRoundIds.map(roundId => {
            const round = rounds.find(r => r.id === roundId);
            return (
              <button key={roundId} onClick={() => setFilterRoundId(roundId)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterRoundId === roundId ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>{round?.name || 'S/D'}</button>
            );
          })}
        </div>
      )}

      {displayedRoundIds.map(roundId => {
        const round = rounds.find(r => r.id === roundId);
        return (
          <div key={roundId} className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{round?.name || 'Sin Fecha'}</h3>
            <div className="space-y-4">
              {groupedMatches[roundId]?.map(match => {
                const home = teams.find(t => t.id === match.homeTeamId);
                const away = teams.find(t => t.id === match.awayTeamId);
                const date = new Date(match.date);

                const homeScorers = match.stats.scorers?.filter(s => {
                  const p = players.find(pl => pl.id === s.playerId);
                  return p && p.teamId === match.homeTeamId;
                }) || [];

                const awayScorers = match.stats.scorers?.filter(s => {
                  const p = players.find(pl => pl.id === s.playerId);
                  return p && p.teamId === match.awayTeamId;
                }) || [];

                return (
                  <div key={match.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500">{date.toLocaleDateString()}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${match.stats.isPlayed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{match.stats.isPlayed ? 'FINAL' : 'PENDIENTE'}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-10 h-10 rounded-full ${home?.logoColor} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>{home?.name.substring(0, 1)}</div>
                          <span className="text-xs font-bold text-center leading-tight line-clamp-2 h-8 flex items-center">{home?.name}</span>
                        </div>
                        <div className="px-3 flex flex-col items-center">
                          {match.stats.isPlayed ? (
                            <div className="text-2xl font-black text-slate-800 tracking-tight bg-slate-100 px-3 py-1 rounded-lg">{match.stats.homeScore}-{match.stats.awayScore}</div>
                          ) : (<span className="text-sm font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded">VS</span>)}
                          <div className="text-[10px] text-slate-400 mt-1 font-medium">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-10 h-10 rounded-full ${away?.logoColor} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>{away?.name.substring(0, 1)}</div>
                          <span className="text-xs font-bold text-center leading-tight line-clamp-2 h-8 flex items-center">{away?.name}</span>
                        </div>
                      </div>
                      {match.stats.isPlayed && (homeScorers.length > 0 || awayScorers.length > 0) && (
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-50">
                          <div className="flex flex-col gap-1.5 items-start pl-2">
                            {homeScorers.map(s => {
                              const p = players.find(pl => pl.id === s.playerId);
                              if (!p) return null;
                              return (<div key={s.playerId} className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium"><span>⚽</span> <span>{p.name} {s.count > 1 && <span className="text-slate-400">({s.count})</span>}</span></div>)
                            })}
                          </div>
                          <div className="flex flex-col gap-1.5 items-end pr-2">
                            {awayScorers.map(s => {
                              const p = players.find(pl => pl.id === s.playerId);
                              if (!p) return null;
                              return (<div key={s.playerId} className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium"><span>{p.name} {s.count > 1 && <span className="text-slate-400">({s.count})</span>}</span> <span>⚽</span></div>)
                            })}
                          </div>
                        </div>
                      )}
                      {canEdit && (
                        <button onClick={() => setEditingMatch(match)} className="w-full mt-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100 flex items-center justify-center gap-2">
                          <Save size={14} /> CARGAR RESULTADO
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {sortedRoundIds.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-slate-400"><Calendar size={48} strokeWidth={1} className="mb-2 opacity-50" /><p className="text-sm">No hay partidos en esta categoría</p></div>}
      {editingMatch && <MatchEditorModal match={editingMatch} onClose={() => setEditingMatch(null)} />}
    </div>
  );
};

const MatchEditorModal = ({ match, onClose }: { match: Match, onClose: () => void }) => {
  const { updateMatch, teams, players } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MatchStats>({ ...match.stats, scorers: match.stats.scorers || [] });

  const homePlayers = players.filter(p => p.teamId === match.homeTeamId);
  const awayPlayers = players.filter(p => p.teamId === match.awayTeamId);
  const allMatchPlayers = [...homePlayers, ...awayPlayers];

  const handleSave = async () => {
    setLoading(true);
    await updateMatch(match.id, { ...stats, isPlayed: true });
    setLoading(false);
    onClose();
  };

  const handleGoalChange = (playerId: string, delta: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const isHome = player.teamId === match.homeTeamId;
    const currentScorers = [...(stats.scorers || [])];
    const existingIndex = currentScorers.findIndex(s => s.playerId === playerId);
    if (existingIndex >= 0) {
      const newCount = currentScorers[existingIndex].count + delta;
      if (newCount <= 0) currentScorers.splice(existingIndex, 1);
      else currentScorers[existingIndex] = { ...currentScorers[existingIndex], count: newCount };
    } else if (delta > 0) currentScorers.push({ playerId, count: delta });
    setStats(prev => ({ ...prev, scorers: currentScorers, homeScore: isHome ? Math.max(0, prev.homeScore + delta) : prev.homeScore, awayScore: !isHome ? Math.max(0, prev.awayScore + delta) : prev.awayScore }));
  };

  const home = teams.find(t => t.id === match.homeTeamId);
  const away = teams.find(t => t.id === match.awayTeamId);

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Actualizar Partido</h3>
          <button onClick={onClose} className="p-1 bg-slate-200 rounded-full text-slate-600"><LogOut size={16} /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-xs font-bold text-slate-500 uppercase truncate w-full text-center">{home?.name}</span>
              <input type="number" inputMode="numeric" min="0" value={stats.homeScore} onChange={e => setStats({ ...stats, homeScore: parseInt(e.target.value) || 0 })} className="w-16 h-16 text-3xl text-center font-black border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all" />
              <div className="w-full space-y-1 mt-1">
                {stats.scorers?.map(s => {
                  const p = homePlayers.find(hp => hp.id === s.playerId);
                  if (!p) return null;
                  return (
                    <div key={s.playerId} className="flex justify-between items-center text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <span className="font-medium truncate max-w-[80px]">{p.name} {s.count > 1 && `x${s.count}`}</span>
                      <button onClick={() => handleGoalChange(s.playerId, -1)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  );
                })}
                <select className="w-full text-[10px] p-2 bg-slate-100 rounded-lg border-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-slate-500 text-center uppercase tracking-wide cursor-pointer hover:bg-slate-200 transition-colors" value="" onChange={(e) => handleGoalChange(e.target.value, 1)}>
                  <option value="">+ Gol</option>
                  {homePlayers.map(p => <option key={p.id} value={p.id}>{p.number}. {p.name}</option>)}
                </select>
              </div>
            </div>
            <span className="text-xl font-bold text-slate-300 pt-6">-</span>
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-xs font-bold text-slate-500 uppercase truncate w-full text-center">{away?.name}</span>
              <input type="number" inputMode="numeric" min="0" value={stats.awayScore} onChange={e => setStats({ ...stats, awayScore: parseInt(e.target.value) || 0 })} className="w-16 h-16 text-3xl text-center font-black border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all" />
              <div className="w-full space-y-1 mt-1">
                {stats.scorers?.map(s => {
                  const p = awayPlayers.find(hp => hp.id === s.playerId);
                  if (!p) return null;
                  return (
                    <div key={s.playerId} className="flex justify-between items-center text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <span className="font-medium truncate max-w-[80px]">{p.name} {s.count > 1 && `x${s.count}`}</span>
                      <button onClick={() => handleGoalChange(s.playerId, -1)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  );
                })}
                <select className="w-full text-[10px] p-2 bg-slate-100 rounded-lg border-transparent focus:bg-white focus:border-slate-300 outline-none font-bold text-slate-500 text-center uppercase tracking-wide cursor-pointer hover:bg-slate-200 transition-colors" value="" onChange={(e) => handleGoalChange(e.target.value, 1)}>
                  <option value="">+ Gol</option>
                  {awayPlayers.map(p => <option key={p.id} value={p.id}>{p.number}. {p.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1 uppercase tracking-wide"><Star size={14} className="text-yellow-500 fill-current" /> MVP del Partido</label>
            <div className="relative">
              <select value={stats.mvpPlayerId || ''} onChange={e => setStats({ ...stats, mvpPlayerId: e.target.value })} className="w-full p-3 pl-4 border border-slate-200 rounded-xl bg-slate-50 text-sm font-medium appearance-none outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Seleccionar Jugador Destacado</option>
                {allMatchPlayers.map(p => (<option key={p.id} value={p.id}>{p.name} (#{p.number})</option>))}
              </select>
              <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400"><ChevronRight size={16} className="rotate-90" /></div>
            </div>
          </div>
          <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20">{loading ? 'Guardando...' : 'Guardar y Finalizar'}</button>
        </div>
      </div>
    </div>
  );
};

const TeamView = () => {
  const { user, teams, players, addPlayer, removePlayer } = useAppContext();
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');

  if (!user) return <div className="p-8 text-center text-slate-400">Inicia sesión para ver tu equipo.</div>;
  if (!user.teamId) return <div className="p-8 text-center text-slate-400">No tienes equipo asignado.</div>;

  const team = teams.find(t => t.id === user.teamId);
  const teamPlayers = players.filter(p => p.teamId === user.teamId);
  const isCaptain = user.role === 'captain';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName && newNumber) {
      addPlayer(newName, parseInt(newNumber), user.teamId!);
      setNewName('');
      setNewNumber('');
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full ${team?.logoColor} flex items-center justify-center text-white font-bold text-xl`}>{team?.name.substring(0, 1)}</div>
        <div><h2 className="font-bold text-lg text-slate-900">{team?.name}</h2><p className="text-xs text-slate-500 uppercase font-medium">{team?.category.replace('_', ' ')}</p></div>
      </div>
      {isCaptain && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
          <h3 className="font-bold text-blue-900 text-sm mb-3 flex items-center gap-2"><UserPlus size={16} /> Agregar Jugador</h3>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 p-2.5 text-sm border border-blue-200 rounded-lg outline-none focus:border-blue-500" required />
            <input placeholder="#" type="number" value={newNumber} onChange={e => setNewNumber(e.target.value)} className="w-14 p-2.5 text-sm text-center border border-blue-200 rounded-lg outline-none focus:border-blue-500" required />
            <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-lg active:bg-blue-700"><Plus size={20} /></button>
          </form>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-800 text-sm px-1">Plantel ({teamPlayers.length})</h3>
        {teamPlayers.map(p => (
          <div key={p.id} className="bg-white p-3 rounded-xl border shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3"><span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-xs font-bold text-slate-600">{p.number}</span><span className="font-medium text-sm text-slate-800">{p.name}</span></div>
            {isCaptain && <button onClick={() => removePlayer(p.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16} /></button>}
          </div>
        ))}
        {teamPlayers.length === 0 && <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed rounded-xl">Sin jugadores</div>}
      </div>
    </div>
  );
};

const ProfileView = () => {
  const { user, teams, logout } = useAppContext();

  if (!user) return null;

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Profile Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-full mx-auto mb-3 flex items-center justify-center text-white shadow-lg ring-4 ring-slate-50">
          <UserIcon size={32} />
        </div>
        <h2 className="font-bold text-xl text-slate-900">{user.name}</h2>
        <p className="text-slate-500 text-sm">{user.email}</p>
        <div className="mt-3 flex justify-center gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600`}>
            {user.role}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm border-b pb-2">Información Personal</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">ID Usuario</span>
              <span className="font-mono text-xs text-slate-400">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rol Actual</span>
              <span className="font-bold text-slate-800 uppercase">{user.role}</span>
            </div>
            {user.teamId && (
              <div className="flex justify-between">
                <span className="text-slate-500">Equipo</span>
                <span className="font-medium text-emerald-600">{teams.find(t => t.id === user.teamId)?.name}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 border border-red-100 hover:bg-red-100"
        >
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
};



// ... (AuthScreen remains the same)
const AuthScreen = () => {
  const { login, register } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) login(email, password);
    else register(email, password, name);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="mx-auto mb-6 w-24 h-24 relative group">
            <div className="absolute inset-0 bg-yellow-500 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <img
              src={LOGO_URL}
              className="relative w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-2xl transform transition-transform group-hover:scale-105"
              alt="La Masía F&C Logo"
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">La Masía F&C</h1>
          <p className="text-slate-400 mt-2 font-medium">Gestión deportiva inteligente</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">NOMBRE</label>
              <input
                className="w-full p-3.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                placeholder="Ej. Lionel Messi"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">EMAIL</label>
            <input
              type="email"
              className="w-full p-3.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">CONTRASEÑA</label>
            <input
              type="password"
              className="w-full p-3.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-yellow-500/20 active:scale-95 transition-all mt-4">
            {isLogin ? 'INGRESAR' : 'CREAR CUENTA'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-yellow-500 text-sm font-semibold hover:text-yellow-400 transition-colors"
          >
            {isLogin ? 'Crear nueva cuenta' : 'Ya tengo cuenta'}
          </button>
        </div>

        <div className="mt-12 text-center">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Acceso Demo</div>
          <button onClick={() => login('admin@torneo.com', '123456')} className="text-xs text-slate-400 underline decoration-slate-600">Entrar como Dueño</button>
        </div>
      </div>
    </div>
  );
};

const HomeView = () => {
  const { user, setActiveView, selectedCategory, matches, teams, rounds } = useAppContext();

  const nextMatch = useMemo(() => {
    // Logic to find next relevant match (e.g. for user's team or just next generally)
    const upcoming = matches
      .filter(m => !m.stats.isPlayed && m.category === selectedCategory)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    return upcoming;
  }, [matches, selectedCategory]);

  const nextMatchRound = useMemo(() => {
    if (!nextMatch) return null;
    return rounds.find(r => r.id === nextMatch.roundId);
  }, [nextMatch, rounds]);

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      {/* Welcome Section */}
      <div className="bg-slate-900 text-white p-6 rounded-b-[2rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Bienvenido de nuevo</p>
          <h1 className="text-2xl font-black tracking-tight mb-4">
            {user ? `Hola, ${user.name.split(' ')[0]}` : 'Bienvenido a La Masía'}
          </h1>

          {/* Main Sponsor Banner */}
          <div className="w-full h-32 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg flex items-center justify-center relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all hover:scale-[1.02]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=600&auto=format&fit=crop')] bg-cover opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative z-10 text-center">
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded text-white backdrop-blur-sm">PATROCINADOR OFICIAL</span>
              <h3 className="text-2xl font-black text-white mt-1 italic tracking-tighter">NIKE FOOTBALL</h3>
              <p className="text-[10px] text-blue-100 font-medium mt-1">Just Do It</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 -mt-4 relative z-20">
        {/* Quick Actions / Featured */}
        {nextMatch ? (
          <div onClick={() => setActiveView('matches')} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:border-slate-300 transition-all">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Calendar size={14} className="text-emerald-500" /> Próximo Partido</h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase tracking-wider">{nextMatchRound?.name || 'PENDIENTE'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-1 w-1/3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                  {teams.find(t => t.id === nextMatch.homeTeamId)?.name[0]}
                </div>
                <span className="text-[10px] font-bold text-slate-600 truncate w-full text-center">{teams.find(t => t.id === nextMatch.homeTeamId)?.name}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1 rounded">VS</span>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(nextMatch.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex flex-col items-center gap-1 w-1/3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                  {teams.find(t => t.id === nextMatch.awayTeamId)?.name[0]}
                </div>
                <span className="text-[10px] font-bold text-slate-600 truncate w-full text-center">{teams.find(t => t.id === nextMatch.awayTeamId)?.name}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center">
            <Trophy size={32} className="mx-auto text-yellow-500 mb-2 opacity-80" />
            <p className="text-sm font-bold text-slate-700">Torneo Finalizado</p>
            <p className="text-xs text-slate-400">No hay partidos pendientes</p>
          </div>
        )}

        {/* Secondary Sponsor */}
        <div className="w-full h-24 bg-slate-900 rounded-xl overflow-hidden relative flex items-center justify-between px-6 group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900 to-slate-900 opacity-90"></div>
          <div className="relative z-10 flex flex-col items-start">
            <span className="text-[9px] text-emerald-400 font-bold tracking-widest uppercase mb-1">Sport Nutrition</span>
            <h3 className="text-lg font-black text-white italic">GATORADE</h3>
          </div>
          <div className="relative z-10 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
            <ChevronRight className="text-white" size={20} />
          </div>
        </div>

        <button onClick={() => setActiveView('standings')} className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
              <Trophy size={20} className="text-yellow-600" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800 text-sm">Tabla de Posiciones</h3>
              <p className="text-[10px] text-slate-400">Ver clasificación completa</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
        </button>
      </div>
    </div>
  );
};

const AdminView = () => {
  const { user, users, teams, rounds, matches, updateUserRole, addTeam, deleteTeam, addRound, deleteRound, addMatch, deleteMatch } = useAppContext();
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'teams' | 'matches'>('users');

  // Teams State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCategory, setNewTeamCategory] = useState<Category>('MASCULINO');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);

  // Rounds State
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundDate, setNewRoundDate] = useState('');
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);

  // New Match State
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newMatchCategory, setNewMatchCategory] = useState<Category>('MASCULINO');
  const [newMatchHome, setNewMatchHome] = useState('');
  const [newMatchAway, setNewMatchAway] = useState('');
  const [showMatchForm, setShowMatchForm] = useState(false);

  // Auto-populate match date from round date when form opens
  useEffect(() => {
    if (showMatchForm && selectedRoundId) {
      const round = rounds.find(r => r.id === selectedRoundId);
      if (round?.date) {
        // Round date is YYYY-MM-DD, Match date needs YYYY-MM-DDTHH:mm
        // Defaulting to 12:00 if only date is provided
        const defaultTime = "12:00";
        setNewMatchDate(`${round.date}T${defaultTime}`);
      }
    }
  }, [showMatchForm, selectedRoundId, rounds]);

  if (!user || (user.role !== 'owner' && user.role !== 'manager')) return <div className="p-8 text-center text-slate-400">Acceso denegado</div>;

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName) {
      addTeam(newTeamName, newTeamCategory, newTeamColor);
      setNewTeamName('');
    }
  };

  const handleAddRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoundName) {
      await addRound(newRoundName, newRoundDate);
      setNewRoundName('');
      setNewRoundDate('');
    }
  };

  const handleAddMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoundId && newMatchDate && newMatchHome && newMatchAway) {
      addMatch(selectedRoundId, newMatchDate, newMatchCategory, newMatchHome, newMatchAway);
      setNewMatchHome('');
      setNewMatchAway('');
      setShowMatchForm(false);
    }
  };

  const filteredTeamsForMatch = teams.filter(t => t.category === newMatchCategory);

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Settings size={20} className="text-slate-900" />
        <h2 className="font-bold text-slate-900 text-lg">Administración</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
        <button onClick={() => setAdminSubTab('users')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap border transition-all ${adminSubTab === 'users' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Usuarios</button>
        <button onClick={() => setAdminSubTab('teams')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap border transition-all ${adminSubTab === 'teams' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Equipos</button>
        <button onClick={() => setAdminSubTab('matches')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap border transition-all ${adminSubTab === 'matches' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Partidos</button>
      </div>

      {/* Users Management */}
      {adminSubTab === 'users' && (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'owner' ? 'bg-black text-white' :
                  u.role === 'manager' ? 'bg-purple-100 text-purple-800' :
                    u.role === 'captain' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-600'
                  }`}>{u.role}</span>
              </div>
              {u.id !== user.id && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2">
                  <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value as Role, u.teamId)} className="w-full text-xs p-2 bg-slate-50 rounded-lg border focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="player">Jugador</option>
                    <option value="captain">Capitán</option>
                    <option value="manager">Encargado</option>
                    <option value="owner">Dueño</option>
                  </select>
                  {u.role === 'captain' && (
                    <select value={u.teamId || ''} onChange={(e) => updateUserRole(u.id, u.role, e.target.value)} className="w-full text-xs p-2 bg-slate-50 rounded-lg border focus:ring-1 focus:ring-blue-500 outline-none">
                      <option value="">Sin Equipo</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Teams Management */}
      {adminSubTab === 'teams' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Crear Nuevo Equipo</h3>
            <form onSubmit={handleAddTeam} className="space-y-3">
              <input placeholder="Nombre del Equipo" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full p-3 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-slate-900" required />
              <div className="flex gap-2">
                <select value={newTeamCategory} onChange={(e) => setNewTeamCategory(e.target.value as Category)} className="flex-1 p-3 text-sm border rounded-lg outline-none bg-white">
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMENINO_A">Femenino A</option>
                  <option value="FEMENINO_B">Femenino B</option>
                </select>
              </div>
              <div className="flex gap-2 overflow-x-auto py-2">
                {TEAM_COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setNewTeamColor(c)} className={`w-8 h-8 rounded-full flex-shrink-0 ${c} ${newTeamColor === c ? 'ring-2 ring-offset-2 ring-slate-900' : ''}`} />
                ))}
              </div>
              <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-transform">Crear Equipo</button>
            </form>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm px-1">Equipos Existentes</h3>
            {teams.map(t => (
              <div key={t.id} className="bg-white p-3 rounded-xl border flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${t.logoColor} flex items-center justify-center text-white font-bold text-xs`}>{t.name.substring(0, 1)}</div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{t.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{t.category.replace('_', ' ')}</div>
                  </div>
                </div>
                <button onClick={() => { if (confirm('¿Eliminar equipo?')) deleteTeam(t.id) }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rounds & Matches Management */}
      {adminSubTab === 'matches' && (
        <div className="space-y-6">
          {/* Create Round */}
          <div className="bg-white p-4 rounded-xl border shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Crear Fecha / Ronda</h3>
            <form onSubmit={handleAddRound} className="space-y-3">
              <div className="flex gap-2">
                <input
                  placeholder="Nombre (ej. Fecha 1, Semifinal)"
                  value={newRoundName}
                  onChange={e => setNewRoundName(e.target.value)}
                  className="flex-1 p-2.5 text-sm border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha por defecto</label>
                <input
                  type="date"
                  value={newRoundDate}
                  onChange={e => setNewRoundDate(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm shadow-sm active:scale-[0.98] transition-all">Crear Ronda</button>
            </form>
          </div>

          {/* Rounds List */}
          <div className="space-y-3">
            {rounds.length === 0 && <p className="text-center text-slate-400 text-xs py-4">No hay fechas creadas. Crea una para comenzar.</p>}

            {rounds.map(round => {
              const roundMatches = matches.filter(m => m.roundId === round.id);
              const isExpanded = expandedRoundId === round.id;

              return (
                <div key={round.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div
                    onClick={() => setExpandedRoundId(isExpanded ? null : round.id)}
                    className="p-4 flex justify-between items-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{round.name}</h3>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{roundMatches.length} partidos</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('¿Borrar fecha y sus partidos?')) deleteRound(round.id); }} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-2 border-t space-y-4">
                      {/* Matches in Round */}
                      {roundMatches.length > 0 ? (
                        <div className="space-y-2">
                          {roundMatches.map(m => {
                            const h = teams.find(t => t.id === m.homeTeamId);
                            const a = teams.find(t => t.id === m.awayTeamId);
                            return (
                              <div key={m.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border text-xs">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700">{h?.name} vs {a?.name}</span>
                                  <span className="text-[10px] text-slate-400">{new Date(m.date).toLocaleString()} • {m.category}</span>
                                </div>
                                <button onClick={() => deleteMatch(m.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                              </div>
                            )
                          })}
                        </div>
                      ) : <p className="text-xs text-slate-400 italic text-center py-2">Sin partidos programados</p>}

                      {/* Add Match Button/Form */}
                      {!showMatchForm ? (
                        <button
                          onClick={() => { setSelectedRoundId(round.id); setShowMatchForm(true); }}
                          className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-bold hover:border-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={14} /> Agregar Partido
                        </button>
                      ) : selectedRoundId === round.id && (
                        <div className="bg-slate-50 p-3 rounded-xl border animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-xs text-slate-700">Nuevo Partido para {round.name}</h4>
                            <button onClick={() => setShowMatchForm(false)}><X size={14} className="text-slate-400" /></button>
                          </div>
                          <form onSubmit={handleAddMatch} className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input type="datetime-local" value={newMatchDate} onChange={e => setNewMatchDate(e.target.value)} className="w-full p-2 text-xs border rounded-lg bg-white outline-none" required />
                              <select value={newMatchCategory} onChange={(e) => setNewMatchCategory(e.target.value as Category)} className="w-full p-2 text-xs border rounded-lg bg-white outline-none">
                                <option value="MASCULINO">Masculino</option>
                                <option value="FEMENINO_A">Femenino A</option>
                                <option value="FEMENINO_B">Femenino B</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select value={newMatchHome} onChange={e => setNewMatchHome(e.target.value)} className="w-full p-2 text-xs border rounded-lg bg-white outline-none" required>
                                <option value="">Local</option>
                                {filteredTeamsForMatch.map(t => <option key={t.id} value={t.id} disabled={t.id === newMatchAway}>{t.name}</option>)}
                              </select>
                              <select value={newMatchAway} onChange={e => setNewMatchAway(e.target.value)} className="w-full p-2 text-xs border rounded-lg bg-white outline-none" required>
                                <option value="">Visitante</option>
                                {filteredTeamsForMatch.filter(t => t.id !== newMatchHome).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </div>
                            <button type="submit" className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm">Guardar Partido</button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const TeamDetailView = () => {
  const { selectedTeamId, teams, players, matches, setActiveView } = useAppContext();
  const team = teams.find(t => t.id === selectedTeamId);

  if (!team) return <div className="p-8 text-center text-slate-400">Equipo no encontrado</div>;

  const roster = players.filter(p => p.teamId === team.id).sort((a, b) => a.number - b.number);

  // Calculate stats
  let played = 0, won = 0, points = 0, goals = 0;
  const teamMatches = matches.filter(m => m.isPlayed && (m.homeTeamId === team.id || m.awayTeamId === team.id));

  teamMatches.forEach(m => {
    played++;
    const isHome = m.homeTeamId === team.id;
    const myScore = isHome ? m.stats.homeScore : m.stats.awayScore;
    const oppScore = isHome ? m.stats.awayScore : m.stats.homeScore;
    goals += myScore;
    if (myScore > oppScore) { won++; points += 3; }
    else if (myScore === oppScore) { points += 1; }
  });

  // Top scorer
  const scorers = roster.map(p => {
    let count = 0;
    teamMatches.forEach(m => {
      m.stats.scorers?.forEach(s => { if (s.playerId === p.id) count += s.count; });
    });
    return { ...p, goals: count };
  }).filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals);

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className={`p-6 pt-10 rounded-b-[2rem] shadow-lg relative overflow-hidden ${team.logoColor}`}>
        <button onClick={() => setActiveView('standings')} className="absolute top-4 left-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex flex-col items-center relative z-10">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl font-bold shadow-xl mb-3 text-slate-800">
            {team.name[0]}
          </div>
          <h1 className="text-2xl font-black text-white text-center leading-tight">{team.name}</h1>
          <span className="text-xs font-bold text-white/80 uppercase tracking-widest mt-1 bg-black/20 px-3 py-1 rounded-full">{team.category.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="p-4 space-y-6 -mt-6 relative z-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-2xl font-black text-slate-800">{points}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Puntos</span>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-2xl font-black text-slate-800">{played}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Juegazos</span>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
            <span className="text-2xl font-black text-emerald-600">{goals}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Goles</span>
          </div>
        </div>

        {/* Roster */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-3 bg-slate-50 border-b">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Users size={16} className="text-blue-500" /> Plantel</h3>
          </div>
          <div className="divide-y max-h-[300px] overflow-y-auto">
            {roster.map(p => (
              <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {p.number}
                  </div>
                  <span className="text-sm font-bold text-slate-700">{p.name}</span>
                </div>
                {scorers.find(s => s.id === p.id) && (
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <span>⚽</span> {scorers.find(s => s.id === p.id)?.goals}
                  </div>
                )}
              </div>
            ))}
            {roster.length === 0 && <div className="p-6 text-center text-slate-400 italic text-xs">Sin jugadores inscritos</div>}
          </div>
        </div>

        {/* Recent Matches */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 text-sm pl-1">Historial de Partidos</h3>
          {teamMatches.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-dashed text-center text-slate-400 text-xs">Sin partidos jugados</div>
          ) : (
            teamMatches.map(m => {
              const isHome = m.homeTeamId === team.id;
              const opponent = teams.find(t => t.id === (isHome ? m.awayTeamId : m.homeTeamId));
              const myScore = isHome ? m.stats.homeScore : m.stats.awayScore;
              const oppScore = isHome ? m.stats.awayScore : m.stats.homeScore;
              const resultColor = myScore > oppScore ? 'bg-emerald-500' : myScore < oppScore ? 'bg-red-500' : 'bg-amber-500';

              return (
                <div key={m.id} className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-10 rounded-full ${resultColor}`}></div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{new Date(m.date).toLocaleDateString()}</span>
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">vs {opponent?.name}</span>
                    </div>
                  </div>
                  <div className="text-lg font-black text-slate-800 bg-slate-50 px-3 py-1 rounded-lg">
                    {m.stats.homeScore}-{m.stats.awayScore}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { activeView } = useAppContext();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <Header />
      <CategoryTabs />

      <main className="max-w-md mx-auto min-h-[calc(100vh-120px)]">
        {activeView === 'home' && <HomeView />}
        {activeView === 'matches' && <MatchesView />}
        {activeView === 'standings' && <StandingsView />}
        {activeView === 'team' && <TeamView />}
        {activeView === 'team_detail' && <TeamDetailView />}
        {activeView === 'admin' && <AdminView />}
        {activeView === 'profile' && <ProfileView />}
        {activeView === 'notifications' && <NotificationsView />}
      </main>

      <BottomNavigation />
    </div>
  );
};

const AppContent = () => {
  const { user } = useAppContext();
  return user ? <Dashboard /> : <AuthScreen />;
};

const App = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);