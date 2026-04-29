/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Receipt, Trash2, UserPlus, Info, History, LayoutDashboard, ChevronRight, CheckCircle2, TrendingUp, LogOut, House, X, Settings, Wallet, Sparkles, Clock3, Moon, Sun } from 'lucide-react';
import { ExtractedReceipt, Person, PERSON_COLORS, SavedReceipt } from './types';
import { processReceipt } from './services/claudeService';
import { cn, formatCurrency, toDateInputValue, toIsoDateLocal } from './lib/utils';
import { readDomIsDark, getStoredTheme, toggleStoredTheme } from './lib/theme';
import { fetchUserProfile, saveUserProfile, DEFAULT_MY_DISPLAY_NAME } from './lib/userProfile';
import { aggregateOwedBalances } from './lib/owedBalances';
import { aggregateMyExpenses } from './lib/myExpenses';
import ReceiptUploader from './components/ReceiptUploader';
import ReceiptView from './components/ReceiptView';
import SplitSummary from './components/SplitSummary';
import BalancesView from './components/BalancesView';
import ExpensesView from './components/ExpensesView';

import { auth, db } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

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
  authInfo: any;
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
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const PRIMARY_PARTICIPANT_ID = '1';

export default function App() {
  const [receipt, setReceipt] = useState<ExtractedReceipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [people, setPeople] = useState<Person[]>(() => [
    { id: PRIMARY_PARTICIPANT_ID, name: DEFAULT_MY_DISPLAY_NAME, color: PERSON_COLORS[0] },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedReceipt[]>([]);
  const [currentView, setCurrentView] = useState<'main' | 'history' | 'balances' | 'expenses'>('main');
  const [user, setUser] = useState<User | null>(null);
  const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNameDraft, setSettingsNameDraft] = useState('');
  const [profileReady, setProfileReady] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editingReceiptTimestamp, setEditingReceiptTimestamp] = useState<number | null>(null);
  const [isDarkUi, setIsDarkUi] = useState(readDomIsDark);

  useEffect(() => {
    if (getStoredTheme() !== null) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const d = mq.matches;
      document.documentElement.classList.toggle('dark', d);
      setIsDarkUi(d);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const myDisplayName =
    people.find((p) => p.id === PRIMARY_PARTICIPANT_ID)?.name?.trim() || DEFAULT_MY_DISPLAY_NAME;

  const { grandTotalOwedToYou } = useMemo(
    () => aggregateOwedBalances(history, myDisplayName),
    [history, myDisplayName]
  );
  const myExpenses = useMemo(
    () => aggregateMyExpenses(history, myDisplayName),
    [history, myDisplayName]
  );
  const myExpenseByReceiptId = useMemo(
    () => new Map(myExpenses.entries.map((entry) => [entry.id, entry])),
    [myExpenses]
  );
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, { monthKey: string; monthLabel: string; entries: SavedReceipt[] }>();

    history.forEach((entry) => {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(entry.data.date || '');
      const date = dateMatch
        ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
        : new Date(entry.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const group = groups.get(monthKey);

      if (group) {
        group.entries.push(entry);
      } else {
        groups.set(monthKey, { monthKey, monthLabel, entries: [entry] });
      }
    });

    return Array.from(groups.values()).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  }, [history]);
  const owedToYouCurrency = history[0]?.data.currency ?? 'USD';

  const openSettings = () => {
    setSettingsNameDraft(
      people.find((p) => p.id === PRIMARY_PARTICIPANT_ID)?.name ?? DEFAULT_MY_DISPLAY_NAME
    );
    setSettingsOpen(true);
  };

  const saveMyDisplayName = async () => {
    const name = settingsNameDraft.trim() || DEFAULT_MY_DISPLAY_NAME;
    const nextPeople = people.map((p) =>
      p.id === PRIMARY_PARTICIPANT_ID ? { ...p, name } : p
    );
    setPeople(nextPeople);
    setSettingsOpen(false);
    if (user) {
      try {
        await saveUserProfile(user.uid, {
          displayName: name,
          participants: nextPeople,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save your name to your account.'
        );
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setHistory([]);
        setProfileReady(false);
      }
    });
    return unsubscribe;
  }, []);

  // Signed-in: load profile (participants + display name) from Firestore.
  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    setProfileReady(false);
    (async () => {
      try {
        const profile = await fetchUserProfile(user.uid);
        if (cancelled) return;

        if (profile?.participants && profile.participants.length > 0) {
          setPeople(profile.participants);
        } else if (profile?.displayName) {
          setPeople((prev) =>
            prev.map((p) =>
              p.id === PRIMARY_PARTICIPANT_ID ? { ...p, name: profile.displayName! } : p
            )
          );
        } else {
          const seed =
            (user.displayName?.trim()?.split(/\s+/)[0] ?? '') || DEFAULT_MY_DISPLAY_NAME;
          setPeople((prev) =>
            prev.map((p) =>
              p.id === PRIMARY_PARTICIPANT_ID ? { ...p, name: seed } : p
            )
          );
        }
      } catch (e) {
        console.warn('Could not load profile from Firebase', e);
      } finally {
        if (!cancelled) {
          setProfileReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Debounced sync of full participant list (and display name) while signed in.
  useEffect(() => {
    if (!user || !profileReady) return;
    const displayName =
      people.find((p) => p.id === PRIMARY_PARTICIPANT_ID)?.name?.trim() ||
      DEFAULT_MY_DISPLAY_NAME;
    const t = window.setTimeout(() => {
      saveUserProfile(user.uid, {
        displayName,
        participants: people,
        updatedAt: Date.now(),
      }).catch((e) => console.warn('Could not sync participants to Firebase', e));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [people, user, profileReady]);

  // Load history from Firestore
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'receipts'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userReceipts = snapshot.docs
        .map((receiptDoc) => ({ docId: receiptDoc.id, ...(receiptDoc.data() as any) }))
        .map(data => ({
          id: data.docId,
          data: data.data,
          people: data.people,
          timestamp: data.timestamp
        }));
        
      userReceipts.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(userReceipts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'receipts');
    });

    return unsubscribe;
  }, [user]);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setEditingReceiptId(null);
    setEditingReceiptTimestamp(null);
    try {
      const data = await processReceipt(file);
      setReceipt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const saveToHistory = async () => {
    if (!receipt || !user) {
      if (!user) setError("You must be signed in to save receipts.");
      return;
    }
    const receiptId = editingReceiptId ?? crypto.randomUUID();
    const isUpdate = Boolean(editingReceiptId);
    const newEntry = {
      userId: user.uid,
      id: receiptId,
      data: receipt,
      people: people,
      timestamp: editingReceiptTimestamp ?? Date.now()
    };
    
    try {
      await setDoc(doc(db, 'receipts', receiptId), newEntry);
      reset();
      setCurrentView('history');
    } catch (error) {
      handleFirestoreError(
        error,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        `receipts/${receiptId}`
      );
    }
  };

  const loadFromHistory = (entry: SavedReceipt) => {
    const validIds = new Set(people.map((p) => p.id));
    const data: ExtractedReceipt = {
      ...entry.data,
      items: entry.data.items.map((item) => ({
        ...item,
        splitWith: item.splitWith.filter((id) => validIds.has(id)),
      })),
    };
    setReceipt(data);
    setEditingReceiptId(entry.id);
    setEditingReceiptTimestamp(entry.timestamp);
    setCurrentView('main');
  };

  const deleteFromHistory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'receipts', id));
      if (editingReceiptId === id) {
        reset();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `receipts/${id}`);
    }
  };

  const addPerson = () => {
    const newId = crypto.randomUUID();
    const color = PERSON_COLORS[people.length % PERSON_COLORS.length];
    setPeople([...people, { id: newId, name: `Person ${people.length + 1}`, color }]);
  };

  const removePerson = (id: string) => {
    if (people.length <= 1) return;
    setPeople(people.filter(p => p.id !== id));
    if (receipt) {
      const updatedItems = receipt.items.map(item => ({
        ...item,
        splitWith: item.splitWith.filter(pId => pId !== id)
      }));
      setReceipt({ ...receipt, items: updatedItems });
    }
  };

  const updatePersonName = (id: string, name: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, name } : p));
  };

  const addShare = (itemId: string, personId: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          splitWith: [...item.splitWith, personId]
        };
      }
      return item;
    });
    setReceipt({ ...receipt, items: updatedItems });
  };

  const removeShare = (itemId: string, personId: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item => {
      if (item.id === itemId) {
        const index = item.splitWith.lastIndexOf(personId);
        if (index === -1) return item;
        const newSplitWith = [...item.splitWith];
        newSplitWith.splice(index, 1);
        return {
          ...item,
          splitWith: newSplitWith
        };
      }
      return item;
    });
    setReceipt({ ...receipt, items: updatedItems });
  };

  const createManualReceipt = () => {
    const newReceipt: ExtractedReceipt = {
      items: [],
      subtotal: 0,
      tax: 0,
      tip: 0,
      fees: 0,
      total: 0,
      date: toIsoDateLocal(new Date()),
      merchantName: 'New Receipt',
      currency: 'USD'
    };
    setReceipt(newReceipt);
    setEditingReceiptId(null);
    setEditingReceiptTimestamp(null);
  };

  const updateItemName = (itemId: string, newName: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item =>
      item.id === itemId ? { ...item, name: newName } : item
    );
    setReceipt({ ...receipt, items: updatedItems });
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (!receipt) return;
    const q = Number.isFinite(newQuantity) && newQuantity > 0 ? newQuantity : 1;
    const updatedItems = receipt.items.map(item =>
      item.id === itemId ? { ...item, quantity: q } : item
    );
    setReceipt({ ...receipt, items: updatedItems });
  };

  const updateItemCategory = (itemId: string, newCategory: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item =>
      item.id === itemId ? { ...item, category: newCategory } : item
    );
    setReceipt({ ...receipt, items: updatedItems });
  };

  const updateItemPrice = (itemId: string, newPrice: number) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item =>
      item.id === itemId ? { ...item, price: newPrice } : item
    );
    const newSubtotal = updatedItems.reduce((acc, item) => acc + item.price, 0);
    const newTotal = newSubtotal + (receipt.tax || 0) + (receipt.tip || 0) + (receipt.fees || 0);

    setReceipt({
      ...receipt,
      items: updatedItems,
      subtotal: newSubtotal,
      total: newTotal
    });
  };

  const addItem = () => {
    if (!receipt) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Item',
      quantity: 1,
      price: 0,
      category: 'Other',
      splitWith: []
    };
    
    const updatedItems = [...receipt.items, newItem];
    const newSubtotal = updatedItems.reduce((acc, item) => acc + item.price, 0);
    const newTotal = newSubtotal + (receipt.tax || 0) + (receipt.tip || 0) + (receipt.fees || 0);

    setReceipt({
      ...receipt,
      items: updatedItems,
      subtotal: newSubtotal,
      total: newTotal
    });
  };

  const deleteItem = (itemId: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.filter(item => item.id !== itemId);
    const newSubtotal = updatedItems.reduce((acc, item) => acc + item.price, 0);
    const newTotal = newSubtotal + (receipt.tax || 0) + (receipt.tip || 0) + (receipt.fees || 0);

    setReceipt({
      ...receipt,
      items: updatedItems,
      subtotal: newSubtotal,
      total: newTotal
    });
  };

  const updateReceiptMetadata = (field: keyof ExtractedReceipt, value: number | string) => {
    if (!receipt) return;
    const newReceipt = { ...receipt, [field]: value };
    if (['tax', 'tip', 'fees'].includes(field)) {
      newReceipt.total = (newReceipt.subtotal || 0) + (Number(newReceipt.tax) || 0) + (Number(newReceipt.tip) || 0) + (Number(newReceipt.fees) || 0);
    }
    setReceipt(newReceipt as ExtractedReceipt);
  };


  const reset = () => {
    setReceipt(null);
    setError(null);
    setEditingReceiptId(null);
    setEditingReceiptTimestamp(null);
  };

  const performGoHome = () => {
    setCurrentView('main');
    reset();
    setHomeConfirmOpen(false);
  };

  const requestHome = () => {
    if (receipt) {
      setHomeConfirmOpen(true);
    } else {
      performGoHome();
    }
  };

  const toggleTheme = () => {
    setIsDarkUi(toggleStoredTheme());
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans dark:bg-slate-950 dark:text-slate-100 p-4 md:p-6 lg:p-8">
      <header className="max-w-7xl mx-auto mb-6">
        <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm px-3 py-3 md:px-4 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-center justify-between gap-4 xl:w-auto">
            <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={requestHome}
              title="Home"
              aria-label="Go to home"
                className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center justify-center transition-colors shrink-0"
            >
              <House className="w-5 h-5" />
            </button>
              <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-950/50 shrink-0">
                <Receipt className="w-5 h-5" />
            </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight truncate">
                  BillSplit AI
                </h1>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                  {user ? user.email || myDisplayName : 'Receipt splitting workspace'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                title={isDarkUi ? 'Light mode' : 'Dark mode'}
                aria-label={isDarkUi ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center justify-center transition-colors"
              >
                {isDarkUi ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={openSettings}
                title="Name settings"
                aria-label="Name settings"
                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center justify-center transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              {user ? (
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-100 dark:hover:border-red-900/60 hover:text-red-500 flex items-center justify-center transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="h-10 px-4 rounded-2xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-100 dark:shadow-indigo-950/50"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row lg:items-center gap-3 min-w-0">
            <nav className="flex-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-2xl overflow-x-auto">
              <div className="grid grid-cols-4 min-w-[420px] md:min-w-0 gap-1">
                <button
                  onClick={() => setCurrentView('main')}
                  className={cn("min-h-10 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5", currentView === 'main' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Split
                </button>
                <button
                  onClick={() => setCurrentView('history')}
                  className={cn("min-h-10 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5", currentView === 'history' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
                >
                  <History className="w-3.5 h-3.5" /> History
                </button>
                <button
                  onClick={() => setCurrentView('balances')}
                  className={cn("min-h-10 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5", currentView === 'balances' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
                >
                  <Users className="w-3.5 h-3.5" /> Totals
                </button>
                <button
                  onClick={() => setCurrentView('expenses')}
                  className={cn("min-h-10 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5", currentView === 'expenses' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
                >
                  <Wallet className="w-3.5 h-3.5" /> Expenses
                </button>
              </div>
            </nav>

            <div className="flex items-center gap-2 lg:justify-end">
              <div className="hidden sm:flex -space-x-2 px-2">
                {people.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: p.color }}
                    title={p.name}
                  >
                    {p.name[0]}
                  </div>
                ))}
                {people.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-400">
                    +{people.length - 3}
                  </div>
                )}
              </div>

              <div className="h-10 min-w-0 rounded-2xl bg-indigo-600 px-4 text-white flex items-center gap-3 shadow-lg shadow-indigo-100 dark:shadow-indigo-950/50">
                <TrendingUp className="w-4 h-4 opacity-80 shrink-0" />
                <div className="leading-none">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Owed</p>
                  <p className="text-sm font-bold whitespace-nowrap">
                    {formatCurrency(grandTotalOwedToYou, owedToYouCurrency)}
                  </p>
                </div>
              </div>

              {receipt && currentView === 'main' && (
                <button
                  onClick={saveToHistory}
                  className="h-10 px-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-lg shadow-slate-200 dark:shadow-slate-950/50 whitespace-nowrap text-sm"
                >
                  {editingReceiptId ? 'Update' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {currentView === 'balances' ? (
            <motion.div
              key="balances"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <BalancesView history={history} myDisplayName={myDisplayName} />
            </motion.div>
          ) : currentView === 'expenses' ? (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ExpensesView history={history} myDisplayName={myDisplayName} />
            </motion.div>
          ) : currentView === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                    Saved receipts
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Split history
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl">
                    Reopen past splits, update assignments, or clean up receipts you no longer need.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 flex items-center gap-3">
                    <History className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <div className="leading-none">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Receipts</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{history.length}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentView('main')}
                    className="h-12 px-5 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-100 dark:shadow-indigo-950/50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New split
                  </button>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-600 rounded-3xl py-20 px-6 text-center">
                  <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/50 rounded-3xl flex items-center justify-center mx-auto text-indigo-500 dark:text-indigo-400 mb-5">
                    <History className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No saved receipts yet</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
                    Once you save a split, it will appear here with the total, date, and participants.
                  </p>
                  <button
                    onClick={() => setCurrentView('main')}
                    className="mt-6 px-5 py-3 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold hover:bg-slate-800 dark:hover:bg-white transition-colors"
                  >
                    Start a new split
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {groupedHistory.map((group) => (
                    <section key={group.monthKey} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{group.monthLabel}</h3>
                          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                            {group.entries.length} {group.entries.length === 1 ? 'receipt' : 'receipts'}
                          </p>
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {group.entries.map((entry) => {
                          const myReceiptExpense = myExpenseByReceiptId.get(entry.id);
                          return (
                            <div key={entry.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-500/40 transition-all relative group overflow-hidden">
                              <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200 dark:via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-11 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                                    <Receipt className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                      {new Date(entry.timestamp).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </p>
                                    <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {entry.data.merchantName || 'Receipt Split'}
                                    </h4>
                                  </div>
                                </div>
                                <button
                                  onClick={() => deleteFromHistory(entry.id)}
                                  title="Delete receipt"
                                  aria-label="Delete receipt"
                                  className="w-9 h-9 rounded-xl text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="mt-6 flex items-end justify-between gap-4">
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                                    Total
                                  </p>
                                  <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
                                    {formatCurrency(entry.data.total, entry.data.currency)}
                                  </div>
                                </div>
                                <div className="flex -space-x-1.5 shrink-0">
                                  {entry.people.slice(0, 5).map(p => (
                                    <div
                                      key={p.id}
                                      className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[9px] font-bold text-white"
                                      style={{ backgroundColor: p.color }}
                                      title={p.name}
                                    >
                                      {p.name[0]}
                                    </div>
                                  ))}
                                  {entry.people.length > 5 && (
                                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[9px] font-bold text-slate-400">
                                      +{entry.people.length - 5}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Items</p>
                                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">{entry.data.items.length}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">People</p>
                                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">{entry.people.length}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">You spent</p>
                                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                                    {formatCurrency(myReceiptExpense?.total ?? 0, myReceiptExpense?.currency ?? entry.data.currency)}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => loadFromHistory(entry)}
                                className="mt-5 w-full h-12 bg-slate-900 dark:bg-slate-100 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white dark:text-slate-900 hover:text-white dark:hover:text-white rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                              >
                                Load receipt <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </motion.div>
          ) : !receipt ? (
            <motion.div
              key="uploader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
            >
              <div className="lg:col-span-5 bg-slate-900 dark:bg-slate-800/90 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-slate-200 dark:shadow-slate-950/50 overflow-hidden relative min-h-[420px] flex flex-col justify-between ring-1 ring-white/5">
                <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full border border-white/10" />
                <div className="absolute right-8 bottom-8 w-28 h-28 rounded-full border border-indigo-400/20" />

                <div className="relative space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-100">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                    AI Receipt Splitting
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.02]">
                      Split the bill before the table goes quiet.
                    </h2>
                    <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-md">
                      Upload a receipt, review the line items, assign people, and save the split to your history.
                    </p>
                  </div>
                </div>

                <div className="relative grid grid-cols-2 gap-3 mt-10">
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-widest">
                      <History className="w-4 h-4 text-indigo-300" />
                      Saved
                    </div>
                    <p className="mt-3 text-3xl font-bold">{history.length}</p>
                    <p className="mt-1 text-xs text-slate-400">receipts</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-widest">
                      <Users className="w-4 h-4 text-indigo-300" />
                      People
                    </div>
                    <p className="mt-3 text-3xl font-bold">{people.length}</p>
                    <p className="mt-1 text-xs text-slate-400">ready to split</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm p-4 md:p-6 flex flex-col">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                      Start a split
                    </p>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Add your receipt
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg">
                      PDF, JPG, or PNG works. You can adjust names, prices, dates, tax, tip, and shares after import.
                    </p>
                  </div>
                  <div className="flex -space-x-2 shrink-0">
                    {people.slice(0, 5).map(p => (
                      <div
                        key={p.id}
                        className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                      >
                        {p.name[0]}
                      </div>
                    ))}
                  </div>
                </div>

                <ReceiptUploader
                  onUpload={handleFileUpload}
                  isProcessing={isProcessing}
                />

                <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:items-center">
                  <div className="h-px bg-slate-200 dark:bg-slate-700 hidden md:block" />
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                    Or
                  </span>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 hidden md:block" />
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={createManualReceipt}
                    className="min-h-16 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Enter manually
                  </button>
                  <button
                    onClick={() => setCurrentView('history')}
                    className="min-h-16 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={history.length === 0}
                  >
                    <Clock3 className="w-5 h-5" />
                    Open history
                  </button>
                </div>

                {error && (
                  <div className="mt-5 p-4 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-2xl flex gap-3 text-red-700 dark:text-red-300">
                    <Info className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    Reads line items
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    Handles tax and tip
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 px-3 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    Saves signed-in splits
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Main Content Grid */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Store Info Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 flex flex-col md:flex-row justify-between shadow-sm">
                  <div className="flex items-start gap-4">
                     <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                       <Receipt className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Merchant</p>
                       <input 
                         type="text" 
                         value={receipt.merchantName || ''}
                         onChange={(e) => updateReceiptMetadata('merchantName', e.target.value)}
                         className="text-lg font-bold bg-transparent outline-none ring-1 ring-transparent focus:ring-indigo-500 rounded px-1 -mx-1 text-slate-900 dark:text-slate-100 border-none inline-block w-full"
                         placeholder="Receipt / Merchant Name"
                       />
                       <input 
                         type="text"
                         value={receipt.orderNumber || ''}
                         onChange={(e) => updateReceiptMetadata('orderNumber', e.target.value)}
                         className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-transparent outline-none ring-1 ring-transparent focus:ring-indigo-500 rounded px-1 -mx-1 border-none inline-block w-full"
                         placeholder="Order Number (optional)"
                       />
                     </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:text-right flex flex-col items-stretch md:items-end gap-2 justify-end">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Transaction Date</p>
                    <input
                      type="date"
                      value={toDateInputValue(receipt.date)}
                      onChange={(e) => updateReceiptMetadata('date', e.target.value)}
                      className="text-base font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full max-w-[12rem] md:ml-auto cursor-pointer"
                      aria-label="Change transaction date"
                    />
                  </div>
                </div>

                {/* Items Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-hidden min-h-[500px]">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Line Items</h2>
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">Select participants for each item</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-[10px] font-black tracking-widest uppercase">
                       <CheckCircle2 className="w-3 h-3" />
                       Extracted
                    </div>
                  </div>
                  <ReceiptView 
                    receipt={receipt} 
                    people={people}
                    onAddShare={addShare}
                    onRemoveShare={removeShare}
                    onUpdatePrice={updateItemPrice}
                    onUpdateItemName={updateItemName}
                    onUpdateCategory={updateItemCategory}
                    onUpdateQuantity={updateItemQuantity}
                    onDeleteItem={deleteItem}
                    onAddItem={addItem}
                    onUpdateMetadata={updateReceiptMetadata}
                  />
                </div>
              </div>

              {/* Sidebar Grid */}
              <div className="lg:col-span-4 flex flex-col gap-6 sticky top-8">
                {/* People Card */}
                <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-8 text-white shadow-xl ring-1 ring-white/5">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-bold">Participants</h3>
                      <p className="text-xs text-slate-400 font-medium">Add people to split bills</p>
                    </div>
                    <button 
                      onClick={addPerson} 
                      className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-900/50"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {people.map((person) => (
                      <div key={person.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg"
                            style={{ backgroundColor: person.color, boxShadow: `0 8px 16px ${person.color}33` }}
                          >
                            {person.name[0]}
                          </div>
                          <div>
                            <input 
                              value={person.name}
                              onChange={(e) => updatePersonName(person.id, e.target.value)}
                              className="bg-transparent font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 w-32 text-white placeholder:text-slate-500"
                            />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active</p>
                          </div>
                        </div>
                        {people.length > 1 && (
                          <button 
                            onClick={() => removePerson(person.id)}
                            className="p-2 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Quick Tip</p>
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      Tap the colored circles in the item list to toggle person assignment. Items can be split between multiple people.
                    </p>
                  </div>
                </div>

                {/* Summary Card */}
                <SplitSummary 
                  receipt={receipt}
                  people={people}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {homeConfirmOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-confirm-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm"
              aria-label="Dismiss"
              onClick={() => setHomeConfirmOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/50 p-6 md:p-8"
            >
              <button
                type="button"
                onClick={() => setHomeConfirmOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-5">
                <House className="w-6 h-6" />
              </div>
              <h2 id="home-confirm-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 pr-10">
                Go home and discard this receipt?
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Your current split will be cleared. Save to history first if you want to keep it.
              </p>
              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setHomeConfirmOpen(false)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performGoHome}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50"
                >
                  Go home
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm"
              aria-label="Dismiss"
              onClick={() => setSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/50 p-6 md:p-8"
            >
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <Settings className="w-6 h-6" />
              </div>
              <h2 id="settings-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 pr-10">
                Your name
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Used as the default participant (first person in the list) and in Totals.
                {user
                  ? ' Saved to your Firebase account (name + participant list).'
                  : ' Applies to this session until you sign in; then it is stored on your account.'}
              </p>
              <label htmlFor="settings-display-name" className="sr-only">
                Display name
              </label>
              <input
                id="settings-display-name"
                type="text"
                value={settingsNameDraft}
                onChange={(e) => setSettingsNameDraft(e.target.value)}
                placeholder={DEFAULT_MY_DISPLAY_NAME}
                className="mt-5 w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="name"
              />
              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveMyDisplayName}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
