"use client";

import React, { useState, useEffect, useMemo } from "react";

// Types
export interface TodoItem {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  createdAt: string;
  dueDate?: string;
}

export interface AuthUser {
  phone: string;
  verifiedAt: string;
}

const COUNTRY_CODES = [
  { code: "91", label: "India (+91)", flag: "🇮🇳" },
  { code: "1", label: "USA/Canada (+1)", flag: "🇺🇸" },
  { code: "44", label: "UK (+44)", flag: "🇬🇧" },
  { code: "971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "966", label: "Saudi Arabia (+966)", flag: "🇸🇦" },
  { code: "61", label: "Australia (+61)", flag: "🇦🇺" },
  { code: "49", label: "Germany (+49)", flag: "🇩🇪" },
  { code: "65", label: "Singapore (+65)", flag: "🇸🇬" },
];

export default function Home() {
  // Auth state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login form state
  const [countryCode, setCountryCode] = useState("91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loginStep, setLoginStep] = useState<"phone" | "otp">("phone");
  const [verificationToken, setVerificationToken] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Todo state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoNotes, setTodoNotes] = useState("");
  const [todoPriority, setTodoPriority] = useState<"low" | "medium" | "high">("medium");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [showAddDetails, setShowAddDetails] = useState(false);

  // Todo Filter & Search
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "high">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");

  // Load auth from localStorage on initial render
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("wapix_auth_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.phone) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse stored user", e);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  // Load todos whenever user changes
  useEffect(() => {
    if (!user) {
      setTodos([]);
      return;
    }
    try {
      const key = `wapix_todos_${user.phone}`;
      const savedTodos = localStorage.getItem(key);
      if (savedTodos) {
        setTodos(JSON.parse(savedTodos));
      } else {
        // If empty, provide a clean welcome task
        const initialTodos: TodoItem[] = [
          {
            id: "welcome-1",
            title: "Welcome to Wapix Todo Manager!",
            notes: "Your tasks are saved securely in your browser's localStorage.",
            completed: false,
            priority: "medium",
            createdAt: new Date().toISOString(),
          },
          {
            id: "welcome-2",
            title: "Create your first custom task",
            notes: "Type above and press Enter or click 'Add Task'.",
            completed: false,
            priority: "high",
            createdAt: new Date().toISOString(),
          },
        ];
        setTodos(initialTodos);
        localStorage.setItem(key, JSON.stringify(initialTodos));
      }
    } catch (e) {
      console.error("Failed to load todos from localStorage", e);
    }
  }, [user]);

  // Sync todos to localStorage on change
  const syncTodosToStorage = (updatedTodos: TodoItem[]) => {
    setTodos(updatedTodos);
    if (user?.phone) {
      try {
        localStorage.setItem(`wapix_todos_${user.phone}`, JSON.stringify(updatedTodos));
      } catch (e) {
        console.error("Failed to persist todos to localStorage", e);
      }
    }
  };

  // Timer countdown for resending OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Clear notifications after 7 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // Handler: Request OTP via Wapix API
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || phone.trim().length < 5) {
      setStatusMessage({ type: "error", text: "Please enter a valid phone number." });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to dispatch OTP via Wapix.");
      }

      setVerificationToken(data.token);
      setNormalizedPhone(data.phone);
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
      }
      setLoginStep("otp");
      setCountdown(60);
      setStatusMessage({
        type: "success",
        text: `OTP dispatched to WhatsApp (+${data.phone})! Check your WhatsApp messages.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp || otp.trim().length < 4) {
      setStatusMessage({ type: "error", text: "Please enter the OTP received on WhatsApp." });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          otp: otp.trim(),
          token: verificationToken,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Verification failed.");
      }

      // Persist auth user to localStorage as explicitly required
      const authenticatedUser: AuthUser = data.user;
      localStorage.setItem("wapix_auth_user", JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);

      // Reset login form fields
      setPhone("");
      setOtp("");
      setVerificationToken("");
      setLoginStep("phone");
      setDebugOtp(null);

      setStatusMessage({
        type: "success",
        text: "Logged in successfully!",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to verify OTP";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Logout
  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("wapix_auth_user");
      setUser(null);
      setLoginStep("phone");
      setOtp("");
      setPhone("");
      setDebugOtp(null);
      setStatusMessage({ type: "info", text: "You have been logged out." });
    }
  };

  // Handler: Add new task
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;

    const newTodo: TodoItem = {
      id: "todo_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      title: todoTitle.trim(),
      notes: todoNotes.trim() ? todoNotes.trim() : undefined,
      completed: false,
      priority: todoPriority,
      createdAt: new Date().toISOString(),
      dueDate: todoDueDate ? todoDueDate : undefined,
    };

    const updated = [newTodo, ...todos];
    syncTodosToStorage(updated);

    // Reset input fields
    setTodoTitle("");
    setTodoNotes("");
    setTodoDueDate("");
    setTodoPriority("medium");
    setShowAddDetails(false);
  };

  // Handler: Toggle complete status
  const handleToggleComplete = (id: string) => {
    const updated = todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    syncTodosToStorage(updated);
  };

  // Handler: Delete task
  const handleDeleteTodo = (id: string) => {
    const updated = todos.filter((t) => t.id !== id);
    syncTodosToStorage(updated);
  };

  // Handler: Start editing
  const startEdit = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditNotes(todo.notes || "");
    setEditPriority(todo.priority);
  };

  // Handler: Save edited task
  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    const updated = todos.map((t) =>
      t.id === id
        ? {
            ...t,
            title: editTitle.trim(),
            notes: editNotes.trim() ? editNotes.trim() : undefined,
            priority: editPriority,
          }
        : t
    );
    syncTodosToStorage(updated);
    setEditingId(null);
  };

  // Handler: Clear all completed tasks
  const handleClearCompleted = () => {
    const remaining = todos.filter((t) => !t.completed);
    if (confirm(`Remove ${todos.length - remaining.length} completed task(s)?`)) {
      syncTodosToStorage(remaining);
    }
  };

  // Handler: Export todos as JSON
  const handleExportTodos = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(todos, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wapix_todos_${user?.phone || "backup"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered & searched todos
  const filteredTodos = useMemo(() => {
    return todos.filter((item) => {
      // Filter status
      if (filter === "active" && item.completed) return false;
      if (filter === "completed" && !item.completed) return false;
      if (filter === "high" && item.priority !== "high") return false;

      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query);
        return matchesTitle || matchesNotes;
      }
      return true;
    });
  }, [todos, filter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const pending = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, percentage };
  }, [todos]);

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading Wapix workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#10151f]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/10">
              <div className="w-full h-full bg-[#10151f] rounded-[11px] flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 3.67C16.58 3.67 20.28 7.37 20.28 11.91C20.28 16.45 16.58 20.15 12.05 20.15C10.63 20.15 9.25 19.78 8.03 19.06L7.74 18.89L4.62 19.71L5.45 16.67L5.27 16.37C4.48 15.12 4.07 13.54 4.07 11.91C4.07 7.37 7.76 3.67 12.05 3.67Z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  Wapix<span className="text-emerald-400">Todo</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  WhatsApp OTP
                </span>
              </div>
              <p className="text-[11px] text-slate-400">LocalStorage Task Manager</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-slate-300">+{user.phone}</span>
              </div>
              <button
                id="logout-btn"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/40 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                title="Log out and clear session"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Global Notification Banner */}
      {statusMessage && (
        <div className="max-w-4xl mx-auto px-4 mt-4 w-full">
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-md animate-fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : statusMessage.type === "error"
                ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
                : "bg-blue-950/60 border-blue-500/40 text-blue-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMessage.type === "success" && (
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {statusMessage.type === "error" && (
                <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {!user ? (
          /* ================= LOGIN FORM VIEW ================= */
          <div className="max-w-md mx-auto mt-6">
            <div className="bg-[#121722] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Background Glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 3.67C16.58 3.67 20.28 7.37 20.28 11.91C20.28 16.45 16.58 20.15 12.05 20.15C10.63 20.15 9.25 19.78 8.03 19.06L7.74 18.89L4.62 19.71L5.45 16.67L5.27 16.37C4.48 15.12 4.07 13.54 4.07 11.91C4.07 7.37 7.76 3.67 12.05 3.67Z" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  WhatsApp OTP Login
                </h1>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Authenticate your phone number via Wapix WhatsApp verification to access your local To-Do dashboard.
                </p>
              </div>

              {loginStep === "phone" ? (
                /* Step 1: Phone Number */
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="phone-input"
                      className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono"
                    >
                      WhatsApp Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="country-code-select"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-[#0b0f14] border border-slate-700 rounded-xl px-2.5 py-3 text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors shrink-0"
                      >
                        {COUNTRY_CODES.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.flag} +{item.code}
                          </option>
                        ))}
                      </select>
                      <input
                        id="phone-input"
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#0b0f14] border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      An OTP code will be sent to your WhatsApp account.
                    </p>
                  </div>

                  <button
                    id="send-otp-btn"
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                        <span>Sending WhatsApp OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Send WhatsApp Code</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <span className="text-[11px] text-slate-400">
                      Powered by{" "}
                      <a
                        href="https://www.wapix.sbs/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline"
                      >
                        Wapix REST API
                      </a>{" "}
                      • LocalStorage Auth
                    </span>
                  </div>
                </form>
              ) : (
                /* Step 2: OTP Verification */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">OTP sent to WhatsApp:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        +{normalizedPhone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoginStep("phone")}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="otp-input"
                      className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono"
                    >
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      id="otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-[#0b0f14] border border-slate-700 rounded-xl px-4 py-3.5 text-center text-xl tracking-[0.5em] font-mono font-bold text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      autoFocus
                    />
                  </div>

                  {/* Dev / testing helper banner */}
                  {debugOtp && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
                      <span>Dev helper OTP: <strong>{debugOtp}</strong></span>
                      <button
                        type="button"
                        onClick={() => setOtp(debugOtp)}
                        className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-bold"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}

                  <button
                    id="verify-otp-btn"
                    type="submit"
                    disabled={isLoading || otp.length < 4}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Enter Workspace</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setLoginStep("phone")}
                      className="text-slate-400 hover:text-white"
                    >
                      ← Back
                    </button>
                    {countdown > 0 ? (
                      <span className="text-slate-400 font-mono text-[11px]">
                        Resend in {countdown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isLoading}
                        className="text-emerald-400 hover:underline font-medium cursor-pointer"
                      >
                        Resend WhatsApp Code
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* ================= AUTHENTICATED TODO APP ================= */
          <div className="space-y-6">
            {/* Header Banner & Stats */}
            <div className="bg-[#121722] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>Task Manager</span>
                    <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      LocalStorage
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    User Session: <span className="font-mono text-emerald-400">+{user.phone}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportTodos}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Export tasks to JSON backup"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export</span>
                  </button>
                  {stats.completed > 0 && (
                    <button
                      onClick={handleClearCompleted}
                      className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear Completed ({stats.completed})
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar & Counter */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                <div className="p-3 rounded-xl bg-[#0b0f14] border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Total Tasks
                  </span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    {stats.total}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#0b0f14] border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Pending
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                    {stats.pending}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#0b0f14] border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Completed
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                    {stats.completed}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#0b0f14] border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Completion
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {stats.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mt-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Create Task Box */}
            <div className="bg-[#121722] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
              <form onSubmit={handleAddTodo} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    id="new-todo-title"
                    type="text"
                    required
                    placeholder="What needs to be done? (e.g. Test Wapix WhatsApp API integration)"
                    value={todoTitle}
                    onChange={(e) => setTodoTitle(e.target.value)}
                    className="flex-1 bg-[#0b0f14] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddDetails(!showAddDetails)}
                    className={`px-3 py-2 text-xs rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      showAddDetails
                        ? "bg-slate-800 border-slate-600 text-white"
                        : "bg-[#0b0f14] border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                    title="Add details, priority, or due date"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="hidden sm:inline">Options</span>
                  </button>
                  <button
                    id="add-todo-btn"
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <span>Add Task</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Optional Details Expandable */}
                {showAddDetails && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 p-3 bg-[#0b0f14] rounded-xl border border-slate-800 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                        Priority
                      </label>
                      <select
                        value={todoPriority}
                        onChange={(e) => setTodoPriority(e.target.value as "low" | "medium" | "high")}
                        className="w-full bg-[#121722] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="low">🟢 Low Priority</option>
                        <option value="medium">🟡 Medium Priority</option>
                        <option value="high">🔴 High Priority</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                        Due Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={todoDueDate}
                        onChange={(e) => setTodoDueDate(e.target.value)}
                        className="w-full bg-[#121722] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                        Notes / Details
                      </label>
                      <input
                        type="text"
                        placeholder="Additional details..."
                        value={todoNotes}
                        onChange={(e) => setTodoNotes(e.target.value)}
                        className="w-full bg-[#121722] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-[#121722] border border-slate-800 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    filter === "all"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  All ({stats.total})
                </button>
                <button
                  onClick={() => setFilter("active")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    filter === "active"
                      ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Pending ({stats.pending})
                </button>
                <button
                  onClick={() => setFilter("completed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    filter === "completed"
                      ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Completed ({stats.completed})
                </button>
                <button
                  onClick={() => setFilter("high")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    filter === "high"
                      ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  High Priority
                </button>
              </div>

              {/* Search Box */}
              <div className="relative sm:w-64">
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121722] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-2.5">
              {filteredTodos.length === 0 ? (
                <div className="bg-[#121722] border border-slate-800 rounded-2xl p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-300">No tasks found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {searchQuery
                      ? "No tasks match your search query."
                      : filter === "completed"
                      ? "You haven't completed any tasks yet."
                      : "Your to-do list is empty. Add a task above to get started!"}
                  </p>
                </div>
              ) : (
                filteredTodos.map((todo) => {
                  const isEditing = editingId === todo.id;

                  return (
                    <div
                      key={todo.id}
                      className={`p-4 rounded-xl border transition-all ${
                        todo.completed
                          ? "bg-[#0e121a]/60 border-slate-800/60 opacity-70"
                          : "bg-[#121722] border-slate-800 hover:border-slate-700 shadow-sm"
                      }`}
                    >
                      {isEditing ? (
                        /* Editing View */
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-[#0b0f14] border border-emerald-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Notes..."
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="flex-1 bg-[#0b0f14] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                            />
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value as "low" | "medium" | "high")}
                              className="bg-[#0b0f14] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(todo.id)}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal View */
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(todo.id)}
                              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                todo.completed
                                  ? "bg-emerald-500 border-emerald-500 text-slate-950"
                                  : "border-slate-600 hover:border-emerald-400 bg-[#0b0f14]"
                              }`}
                              title={todo.completed ? "Mark pending" : "Mark completed"}
                            >
                              {todo.completed && (
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-medium break-words ${
                                    todo.completed
                                      ? "line-through text-slate-500"
                                      : "text-slate-100"
                                  }`}
                                >
                                  {todo.title}
                                </span>

                                {/* Priority Badge */}
                                <span
                                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                                    todo.priority === "high"
                                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                      : todo.priority === "medium"
                                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                      : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                  }`}
                                >
                                  {todo.priority.toUpperCase()}
                                </span>

                                {todo.dueDate && (
                                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {todo.dueDate}
                                  </span>
                                )}
                              </div>

                              {todo.notes && (
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed break-words">
                                  {todo.notes}
                                </p>
                              )}

                              <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-mono">
                                <span>
                                  Created {new Date(todo.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(todo)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTodo(todo.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#0b0f14] py-6 text-center text-xs text-slate-400">
        <p>
          Wapix WhatsApp Authentication &amp; LocalStorage To-Do System • Built with Next.js
        </p>
      </footer>
    </div>
  );
}
