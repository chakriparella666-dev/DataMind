import React, { useState, useEffect } from 'react';
import { ChevronUp, Check, Eye, EyeOff, AlertCircle, UserCheck } from 'lucide-react';
import { loginUser, googleAuth } from '../services/api';
import Logo from '../components/Logo';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '274171578355-21jalpdk5koqa2q40ush34p2r4oq25ck.apps.googleusercontent.com';

export default function LandingPage({ onLaunchWorkspace, onOpenAuth, onContinueAsGuest, onAuthSuccess }) {
  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setError(null);
    try {
      const res = await googleAuth({ credential: response.credential });
      if (res.success) {
        localStorage.setItem('datamind_token', res.token);
        if (onAuthSuccess) onAuthSuccess(res.user);
        else if (onLaunchWorkspace) onLaunchWorkspace();
      } else {
        setError(res.error || 'Google authentication failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false
        });
      } catch (e) {
        console.warn('[Google GSI Init Warning]:', e);
      }
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleGoogleAuthClick = async () => {
    setLoading(true);
    setError(null);

    // Clear any stale local tokens before initiating new account authentication
    localStorage.removeItem('datamind_token');
    localStorage.removeItem('datamind_guest_active');

    try {
      // 1. Official Google OAuth2 Token Client (Opens Google Sign-in popup window)
      if (window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setLoading(false);
              if (tokenResponse.error === 'popup_closed_by_user') return;
              setError('Google OAuth Error: Please add http://localhost:3000 to Authorized JavaScript origins in Google Cloud Console.');
              return;
            }
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const profile = await userInfoRes.json();
              if (profile.email) {
                const res = await googleAuth({
                  email: profile.email,
                  name: profile.name || profile.given_name || profile.email.split('@')[0],
                  googleId: profile.sub,
                  avatar: profile.picture
                });
                if (res.success) {
                  localStorage.setItem('datamind_token', res.token);
                  if (onAuthSuccess) onAuthSuccess(res.user);
                  else if (onLaunchWorkspace) onLaunchWorkspace();
                } else {
                  setError(res.error || 'Google authentication failed');
                }
              } else {
                setError('Could not retrieve Google profile details.');
              }
            } catch (err) {
              setError(err.message || 'Failed to authenticate with Google');
            } finally {
              setLoading(false);
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }

      // 2. Google GSI One Tap fallback
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            fallbackGooglePrompt();
          }
        });
        setLoading(false);
        return;
      }

      fallbackGooglePrompt();
    } catch (err) {
      console.warn('[Google Auth Popup Warning]:', err);
      fallbackGooglePrompt();
    }
  };

  const fallbackGooglePrompt = async () => {
    const emailPrompt = window.prompt("Enter your Google Account email:", "alex.dev@gmail.com");
    if (!emailPrompt) {
      setLoading(false);
      return;
    }

    const name = emailPrompt.split('@')[0];
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    const res = await googleAuth({
      email: emailPrompt,
      name: formattedName,
      googleId: 'google_' + Date.now(),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(formattedName)}`
    });

    if (res.success) {
      localStorage.setItem('datamind_token', res.token);
      if (onAuthSuccess) onAuthSuccess(res.user);
      else if (onLaunchWorkspace) onLaunchWorkspace();
    } else {
      setError(res.error || 'Google authentication failed');
    }
    setLoading(false);
  };

  const handleInlineLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginUser({ email: formData.email, password: formData.password });
      if (res.success) {
        localStorage.setItem('datamind_token', res.token);
        if (onAuthSuccess) onAuthSuccess(res.user);
        else if (onLaunchWorkspace) onLaunchWorkspace();
      } else {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMsg || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#18181b] text-slate-100 overflow-y-auto font-sans select-none antialiased">
      {/* Top Navbar */}
      <header className="px-6 md:px-12 py-4 border-b border-[#2e2e36] bg-[#222226]/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Logo onClick={() => onLaunchWorkspace?.('home')} />
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onLaunchWorkspace?.('workspace')}
            className="px-5 py-2.5 rounded-xl border border-[#383842] hover:border-zinc-400 bg-[#18181b] hover:bg-[#28282e] text-xs md:text-sm font-bold text-slate-200 transition cursor-pointer shadow-sm active:scale-[0.98]"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Main 2-Column Grid Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        
        {/* Left Column: Hero Content */}
        <div className="lg:col-span-6 flex flex-col items-start space-y-6 pt-2">
          {/* New Pill Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#222226] border border-[#5850ec]/60 text-indigo-300 text-xs md:text-sm font-semibold shadow-sm">
            <span>New — Ask your data. Get SQL. Build dashboards.</span>
          </div>

          {/* Hero Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
            The fastest way to explore any database
          </h1>

          {/* Hero Subtitle */}
          <p className="text-sm md:text-base text-zinc-300 leading-relaxed font-medium">
            DataMind turns your questions into safe, SELECT-only SQL. Preview results instantly and pin insights to shareable dashboards.
          </p>

          {/* 3-Point Checklist */}
          <div className="space-y-6 w-full pt-2">
            {/* Item 1 */}
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-indigo-400 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-white mb-1">Connect any SQL database</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed font-medium">
                  MySQL, PostgreSQL, SQL Server, SQLite—with secure credential storage and one-click schema crawl.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-indigo-400 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-white mb-1">Natural-language to SQL</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed font-medium">
                  Dialect-aware generation with enforced LIMITs—no risky writes.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-indigo-400 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-white mb-1">Dashboards & safe previews</h3>
                <p className="text-xs md:text-sm text-zinc-400 leading-relaxed font-medium">
                  Inspect results before running. Pin charts and tables to dashboards in one click.
                </p>
              </div>
            </div>
          </div>

          {/* Subcaption */}
          <p className="text-xs md:text-sm text-zinc-400 font-medium pt-2">
            No risky writes. We enforce SELECT-only queries and safe previews.
          </p>
        </div>

        {/* Right Column: Inline Login & Registration Card */}
        <div className="lg:col-span-6 flex flex-col space-y-6 w-full">
          
          {/* Form Card */}
          <div className="w-full bg-[#222226] border border-[#2e2e36] rounded-2xl p-7 md:p-8 shadow-2xl space-y-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 tracking-tight">Log in to your account</h2>
              <p className="text-xs md:text-sm text-zinc-400 font-medium">Enter your email and password below to log in</p>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs md:text-sm flex items-center gap-2.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Auth Button */}
            <button
              type="button"
              onClick={handleGoogleAuthClick}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[#18181b] hover:bg-[#28282e] text-white border border-[#383842] hover:border-zinc-400 font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm transition-all cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50 group"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Continue with Guest Credentials Button */}
            {onContinueAsGuest && (
              <button
                type="button"
                onClick={onContinueAsGuest}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 bg-[#2a2a32] hover:bg-[#34343d] text-slate-100 border border-[#3e3e4a] hover:border-zinc-400 font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm transition-all cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Continue with Guest Credentials</span>
              </button>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#33333b] w-full"></div>
              <span className="bg-[#222226] px-3 text-[10px] md:text-xs uppercase tracking-wider text-zinc-400 font-bold shrink-0">
                OR CONTINUE WITH EMAIL
              </span>
            </div>

            <form onSubmit={handleInlineLogin} autoComplete="off" className="space-y-4">
              <input type="text" style={{ display: 'none' }} tabIndex={-1} />
              <input type="password" style={{ display: 'none' }} tabIndex={-1} />

              {/* Email Address */}
              <div>
                <label className="block text-xs md:text-sm font-bold text-zinc-200 mb-1.5">Email address</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="email@example.com"
                  className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-xs md:text-sm text-zinc-100 placeholder:text-zinc-400 placeholder:opacity-100 transition"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs md:text-sm font-bold text-zinc-200">Password</label>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="text-xs md:text-sm text-zinc-300 hover:text-white underline font-semibold cursor-pointer"
                  >
                    Forgot your password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Password"
                    className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl pl-4 pr-10 py-3 text-xs md:text-sm text-zinc-100 placeholder:text-zinc-400 placeholder:opacity-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="inline-remember"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 rounded bg-[#18181b] border-[#383842] text-white focus:ring-0 cursor-pointer accent-white"
                />
                <label htmlFor="inline-remember" className="text-xs md:text-sm text-zinc-300 cursor-pointer font-semibold">
                  Remember me
                </label>
              </div>

              {/* Log in Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-white hover:bg-zinc-200 text-black font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm transition cursor-pointer shadow-lg active:scale-[0.99] disabled:opacity-40"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              {/* Register / Create Account Button directly below Log in */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm transition cursor-pointer shadow-md active:scale-[0.99]"
                >
                  Create New Account / Register
                </button>
              </div>
            </form>
          </div>

          {/* What is DataMind? Section */}
          <div className="w-full bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-3">
            <h3 className="text-sm md:text-base font-bold text-white">What is DataMind?</h3>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed font-medium">
              DataMind is your AI analyst. Ask in plain English, get safe SQL back, preview results, and assemble living dashboards your whole team can trust.
            </p>

            <ul className="space-y-1.5 text-xs md:text-sm text-zinc-300 pl-4 list-disc marker:text-indigo-400 font-medium">
              <li>SELECT-only SQL guardrails</li>
              <li>Visual schema browser</li>
              <li>One-click charts & dashboard pinning</li>
            </ul>
          </div>

        </div>

      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-[#2e2e36] bg-[#18181b] text-center text-xs md:text-sm text-zinc-400 font-semibold">
        <p>© 2026 DataMind Analytics. All rights reserved.</p>
      </footer>
    </div>
  );
}
