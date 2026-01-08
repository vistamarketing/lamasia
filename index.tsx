// ... (imports remain the same, ensure all necessary icons are imported)
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Trophy, Calendar, Users, Shield, Star, LogOut,
  ChevronRight, Plus, Save, Trash2, Award, Activity, Lock,
  User as UserIcon, Settings, List, UserPlus, Filter, X, Bell, Mail, Info, CheckCheck
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
type ViewState = 'matches' | 'standings' | 'team' | 'profile' | 'notifications';

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
  matchDay: number;
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

const INITIAL_MATCHES: Match[] = [
  {
    id: 'm1',
    matchDay: 1,
    date: '2023-11-10T18:00',
    category: 'MASCULINO',
    homeTeamId: 't1',
    awayTeamId: 't2',
    stats: { homeScore: 2, awayScore: 1, scorers: [], isPlayed: true }
  },
  {
    id: 'm2',
    matchDay: 1,
    date: '2023-11-10T19:30',
    category: 'FEMENINO_A',
    homeTeamId: 't3',
    awayTeamId: 't4',
    stats: { homeScore: 0, awayScore: 0, scorers: [], isPlayed: false }
  },
  {
    id: 'm3',
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
  addMatch: (matchDay: number, date: string, category: Category, homeTeamId: string, awayTeamId: string) => void;
  deleteMatch: (matchId: string) => void;
  sendNotification: (userId: string | 'all', title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
  markAsRead: (notificationId: string) => void;
  activeView: ViewState;
  setActiveView: (view: ViewState) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const [activeView, setActiveView] = useState<ViewState>('matches');

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>('MASCULINO');

  // Firebase Auth Listener
  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user data from Firestore
        unsubUser = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnapshot) => {
          if (docSnapshot.exists()) {
            setUser({ id: docSnapshot.id, ...docSnapshot.data() } as User);
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
    return () => {
      unsubTeams();
      unsubMatches();
      unsubPlayers();
      unsubNotifs();
    };
  }, []);

  // Reset view on login/logout
  useEffect(() => {
    setActiveView('matches');
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
      const newUser = { email, name, role: 'player' };
      await setDoc(doc(db, "users", cred.user.uid), newUser);
      await sendNotification(cred.user.uid, 'Registro Exitoso', 'Gracias por registrarte en La Masía F&C.');
    } catch (e: any) {
      alert('Error en registro: ' + e.message);
    }
  };

  const logout = () => {
    signOut(auth);
    setActiveView('matches');
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
    const newTeam = {
      name,
      category,
      logoColor
    };
    await addDoc(collection(db, "teams"), newTeam);
    await sendNotification('all', 'Nuevo Equipo', `Se ha inscrito el equipo ${name} en ${category.replace('_', ' ')}`);
  };

  const deleteTeam = async (teamId: string) => {
    await deleteDoc(doc(db, "teams", teamId));
  };

  const addMatch = async (matchDay: number, date: string, category: Category, homeTeamId: string, awayTeamId: string) => {
    const newMatch = {
      matchDay,
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
      activeView, setActiveView
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
        <div className="flex items-center space-x-3" onClick={() => setActiveView('matches')}>
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

  // Hide category tabs if in profile or notifications view to reduce clutter
  if (activeView === 'profile' || activeView === 'notifications') return null;

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
  const { activeView, setActiveView } = useAppContext();

  const navItems = [
    { id: 'matches', icon: Calendar, label: 'Partidos' },
    { id: 'standings', icon: List, label: 'Tabla' },
    { id: 'team', icon: Shield, label: 'Mi Equipo' }
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
  const { teams, matches, selectedCategory } = useAppContext();
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

  return (
    <div className="p-4 pb-24">
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-3 bg-slate-50 border-b flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Activity size={16} className="text-emerald-600" />Tabla de Posiciones</h2>
          <span className="text-xs text-slate-400 font-medium">{selectedCategory.replace('_', ' ')}</span>
        </div>
        <div className="overflow-x-auto">
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
                <tr key={row.team.id} className="hover:bg-slate-50">
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
        </div>
      </div>
    </div>
  );
};

const MatchesView = () => {
  const { matches, teams, selectedCategory, user, players } = useAppContext();
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [filterDay, setFilterDay] = useState<number | 'all'>('all');

  useEffect(() => { setFilterDay('all'); }, [selectedCategory]);

  const { groupedMatches, sortedDays } = useMemo(() => {
    const categoryMatches = matches.filter(m => m.category === selectedCategory);
    const groups: Record<number, Match[]> = {};
    categoryMatches.forEach(m => {
      if (!groups[m.matchDay]) groups[m.matchDay] = [];
      groups[m.matchDay].push(m);
    });
    const days = Object.keys(groups).map(Number).sort((a, b) => a - b);
    return { groupedMatches: groups, sortedDays: days };
  }, [matches, selectedCategory]);

  const displayedDays = filterDay === 'all' ? sortedDays : sortedDays.filter(d => d === filterDay);
  const canEdit = user && (user.role === 'owner' || user.role === 'manager');

  return (
    <div className="p-4 pb-24 space-y-4">
      {sortedDays.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2">
          <button onClick={() => setFilterDay('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterDay === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Todos</button>
          {sortedDays.map(day => (
            <button key={day} onClick={() => setFilterDay(day)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${filterDay === day ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Fecha {day}</button>
          ))}
        </div>
      )}

      {displayedDays.map(day => (
        <div key={day} className="space-y-3">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span>Fecha {day}</h3>
          <div className="space-y-4">
            {groupedMatches[day]?.map(match => {
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
      ))}
      {sortedDays.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-slate-400"><Calendar size={48} strokeWidth={1} className="mb-2 opacity-50" /><p className="text-sm">No hay partidos en esta categoría</p></div>}
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
  const { user, users, teams, matches, notifications, updateUserRole, addTeam, deleteTeam, addMatch, deleteMatch, logout } = useAppContext();
  const [activeTab, setActiveTab] = useState<'info' | 'admin'>('info');

  // Teams State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCategory, setNewTeamCategory] = useState<Category>('MASCULINO');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);

  // Matches State
  const [newMatchDay, setNewMatchDay] = useState(1);
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newMatchCategory, setNewMatchCategory] = useState<Category>('MASCULINO');
  const [newMatchHome, setNewMatchHome] = useState('');
  const [newMatchAway, setNewMatchAway] = useState('');

  // Admin Tab Sub-state
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'teams' | 'matches'>('users');

  if (!user) return null;

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName) {
      addTeam(newTeamName, newTeamCategory, newTeamColor);
      setNewTeamName('');
    }
  };

  const handleAddMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMatchDate && newMatchHome && newMatchAway) {
      addMatch(newMatchDay, newMatchDate, newMatchCategory, newMatchHome, newMatchAway);
      setNewMatchHome('');
      setNewMatchAway('');
    }
  };

  const filteredTeamsForMatch = teams.filter(t => t.category === newMatchCategory);

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

      {/* Main Tabs (Only for Owners or if we add more tabs later) */}
      {user.role === 'owner' && (
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'info' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            <Info size={14} /> DATOS
          </button>
          <button onClick={() => setActiveTab('admin')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            <Lock size={14} /> ADMIN
          </button>
        </div>
      )}

      {activeTab === 'info' && (
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
      )}

      {activeTab === 'admin' && user.role === 'owner' && (
        <div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
            <button onClick={() => setAdminSubTab('users')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border ${adminSubTab === 'users' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Usuarios</button>
            <button onClick={() => setAdminSubTab('teams')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border ${adminSubTab === 'teams' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Equipos</button>
            <button onClick={() => setAdminSubTab('matches')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border ${adminSubTab === 'matches' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Partidos</button>
          </div>

          {/* Admin Sub-Tabs Content (Reused from previous AdminView logic) */}
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

          {adminSubTab === 'teams' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-3">Nuevo Equipo</h3>
                <form onSubmit={handleAddTeam} className="space-y-3">
                  <input placeholder="Nombre del Equipo" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full p-2.5 text-sm border rounded-lg bg-slate-50" required />
                  <select value={newTeamCategory} onChange={(e) => setNewTeamCategory(e.target.value as Category)} className="w-full p-2.5 text-sm border rounded-lg bg-slate-50">
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMENINO_A">Femenino A</option>
                    <option value="FEMENINO_B">Femenino B</option>
                  </select>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {TEAM_COLORS.map(c => (
                      <button type="button" key={c} onClick={() => setNewTeamColor(c)} className={`w-8 h-8 rounded-full flex-shrink-0 ${c} ${newTeamColor === c ? 'ring-2 ring-offset-2 ring-slate-900' : ''}`} />
                    ))}
                  </div>
                  <button className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-bold">Crear Equipo</button>
                </form>
              </div>

              <div className="space-y-2">
                {teams.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-white border rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${t.logoColor} flex items-center justify-center text-white font-bold text-xs`}>{t.name.substring(0, 1)}</div>
                      <div>
                        <div className="font-bold text-sm">{t.name}</div>
                        <div className="text-[10px] text-slate-500">{t.category}</div>
                      </div>
                    </div>
                    <button onClick={() => deleteTeam(t.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminSubTab === 'matches' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-3">Nuevo Partido</h3>
                <form onSubmit={handleAddMatch} className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Categoría</label>
                      <select value={newMatchCategory} onChange={(e) => setNewMatchCategory(e.target.value as Category)} className="w-full p-2 text-sm border rounded-lg bg-slate-50">
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMENINO_A">Femenino A</option>
                        <option value="FEMENINO_B">Femenino B</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha #</label>
                      <input type="number" min="1" value={newMatchDay} onChange={e => setNewMatchDay(parseInt(e.target.value))} className="w-full p-2 text-sm border rounded-lg bg-slate-50 text-center" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Día y Hora</label>
                    <input type="datetime-local" value={newMatchDate} onChange={e => setNewMatchDate(e.target.value)} className="w-full p-2 text-sm border rounded-lg bg-slate-50" required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Local</label>
                      <select value={newMatchHome} onChange={e => setNewMatchHome(e.target.value)} className="w-full p-2 text-xs border rounded-lg bg-slate-50" required>
                        <option value="">Seleccionar</option>
                        {filteredTeamsForMatch.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Visitante</label>
                      <select value={newMatchAway} onChange={e => setNewMatchAway(e.target.value)} className="w-full p-2 text-xs border rounded-lg bg-slate-50" required>
                        <option value="">Seleccionar</option>
                        {filteredTeamsForMatch.filter(t => t.id !== newMatchHome).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-bold">Programar Partido</button>
                </form>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900 px-1">Últimos Partidos</h3>
                {matches.slice().reverse().slice(0, 10).map(m => {
                  const h = teams.find(t => t.id === m.homeTeamId);
                  const a = teams.find(t => t.id === m.awayTeamId);
                  return (
                    <div key={m.id} className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-slate-400 mb-1">FECHA {m.matchDay} • {m.category}</div>
                        <div className="text-xs font-semibold">{h?.name} vs {a?.name}</div>
                      </div>
                      <button onClick={() => deleteMatch(m.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
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
        {activeView === 'matches' && <MatchesView />}
        {activeView === 'standings' && <StandingsView />}
        {activeView === 'team' && <TeamView />}
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