import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, X, UserCheck } from 'lucide-react';
import { loginUser, registerUser, googleAuth } from '../services/api';
import Logo from './Logo';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '274171578355-21jalpdk5koqa2q40ush34p2r4oq25ck.apps.googleusercontent.com';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, onContinueAsGuest }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setError(null);
    try {
      const res = await googleAuth({ credential: response.credential });
      if (res.success) {
        localStorage.setItem('datamind_token', res.token);
        onAuthSuccess(res.user);
        onClose();
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
    if (isOpen && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false
        });
      } catch (e) {
        console.warn('[Google GSI Init Warning]:', e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGoogleAuthClick = async () => {
    setLoading(true);
    setError(null);

    // Clear any stale local tokens before initiating new account authentication
    localStorage.removeItem('datamind_token');
    localStorage.removeItem('datamind_guest_active');

    try {
      if (window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setLoading(false);
              if (tokenResponse.error === 'popup_closed_by_user') return;
              redirectToGoogleOAuth();
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
                  onClose();
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

      redirectToGoogleOAuth();
    } catch (err) {
      console.warn('[Google Auth Warning]: Redirecting to Google OAuth -', err);
      redirectToGoogleOAuth();
    }
  };

  const redirectToGoogleOAuth = () => {
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: 'email profile openid',
        prompt: 'select_account'
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (e) {
      setError('Failed to launch Google Sign In');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isRegister && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await registerUser({
          name: formData.name,
          email: formData.email,
          password: formData.password
        });
      } else {
        res = await loginUser({ email: formData.email, password: formData.password });
      }

      if (res.success) {
        localStorage.setItem('datamind_token', res.token);
        onAuthSuccess(res.user);
        onClose();
      } else {
        setError(res.error || 'Authentication failed');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(serverMsg || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-[#0d0f14] border border-zinc-800 w-full max-w-md rounded-3xl p-7 shadow-2xl relative text-slate-100 flex flex-col font-sans antialiased max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Icon / Logo */}
        <div className="flex justify-center mb-3 pt-2">
          <Logo iconSize="w-11 h-11" showText={false} />
        </div>

        {/* Header Title & Subtitle */}
        <h2 className="text-3xl font-black text-white text-center tracking-tight mb-1.5">
          {isRegister ? 'Register' : 'Sign In'}
        </h2>
        <p className="text-sm md:text-base text-zinc-300 text-center font-medium mb-6">
          {isRegister ? 'Create your account to get started.' : 'Login to your DataMind account.'}
        </p>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Authentication Button */}
        <button
          type="button"
          onClick={handleGoogleAuthClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#161920] hover:bg-[#1f2430] text-white border border-zinc-700/80 hover:border-zinc-500 font-bold py-3.5 px-4 rounded-2xl transition-all cursor-pointer shadow-md hover:shadow-lg mb-3 active:scale-[0.99] disabled:opacity-50 group"
        >
          <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
          <span className="text-sm md:text-base font-bold">
            {isRegister ? 'Sign up with Google' : 'Sign in with Google'}
          </span>
        </button>

        {/* Continue with Guest Credentials Button */}
        {onContinueAsGuest && (
          <button
            type="button"
            onClick={onContinueAsGuest}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-zinc-800/90 hover:bg-zinc-700 text-slate-100 border border-zinc-700 font-bold py-3 px-4 rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow mb-5 active:scale-[0.99] disabled:opacity-50"
          >
            <UserCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            <span className="text-sm md:text-base font-bold">Continue with Guest Credentials</span>
          </button>
        )}

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-zinc-800 w-full"></div>
          <span className="bg-[#0d0f14] px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-bold shrink-0">
            or continue with email
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 md:space-y-5">
          <input type="text" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} />

          {isRegister ? (
            /* Register Mode Fields */
            <>
              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold text-zinc-200 mb-2">Full name</label>
                <input
                  type="text"
                  name="name"
                  autoComplete="off"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Full name"
                  className="w-full bg-[#14171d] border border-zinc-700/80 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm md:text-base text-white placeholder-zinc-500 transition"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-bold text-zinc-200 mb-2">Email address</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="name@gmail.com"
                  className="w-full bg-[#14171d] border border-zinc-700/80 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm md:text-base text-white placeholder-zinc-500 transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-zinc-200 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Password"
                    className="w-full bg-[#14171d] border border-zinc-700/80 focus:border-white focus:outline-none rounded-xl px-4 py-3 pr-10 text-sm md:text-base text-white placeholder-zinc-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-bold text-zinc-200 mb-2">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Confirm password"
                    className="w-full bg-[#14171d] border border-zinc-700/80 focus:border-white focus:outline-none rounded-xl px-4 py-3 pr-10 text-sm md:text-base text-white placeholder-zinc-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Sign In Mode Fields */
            <>
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-zinc-200 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="name@gmail.com"
                  className="w-full bg-[#14171d] border border-zinc-700/80 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm md:text-base text-white placeholder-zinc-500 transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-zinc-200 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Password"
                    className="w-full bg-[#14171d] border border-zinc-700/80 focus:border-white focus:outline-none rounded-xl px-4 py-3 pr-10 text-sm md:text-base text-white placeholder-zinc-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3">
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(null); }}
              className="text-sm font-bold underline text-zinc-300 hover:text-white transition cursor-pointer"
            >
              {isRegister ? 'Already registered?' : 'Not registered yet?'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 bg-white hover:bg-zinc-200 text-black font-black text-sm md:text-base rounded-xl transition cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-40"
            >
              {loading ? 'Please wait...' : (isRegister ? 'Register' : 'Login')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
