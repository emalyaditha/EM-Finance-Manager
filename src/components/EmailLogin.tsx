import React, { useState, useEffect, useRef } from 'react';
import { Mail, ShieldCheck, KeyRound, AlertCircle, RefreshCw, Clipboard, Check, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmailLoginProps {
  onUnlocked: () => void;
}

export default function EmailLogin({ onUnlocked }: EmailLoginProps) {
  const [email, setEmail] = useState<string>('emalyaditha@gmail.com');
  const [showOtpScreen, setShowOtpScreen] = useState<boolean>(false);
  const [otpValue, setOtpValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  
  // Dev assistance state
  const [sandboxOtp, setSandboxOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Countdown timer for code resend (60 seconds)
  const [resendTimer, setResendTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail !== 'emalyaditha@gmail.com') {
      setErrorMsg('Access Denied: This system is securely bonded exclusively to emalyaditha@gmail.com.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setSandboxOtp(null);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch verification code.');
      }

      setShowOtpScreen(true);
      setResendTimer(60);

      if (data.emailSent) {
        setInfoMsg('A secure 2FA passcode has been dispatched directly to your email!');
      } else {
        // SMTP unconfigured in dev sandbox - provide devOtp for frictionless testing
        setSandboxOtp(data.devOtp);
        setInfoMsg('2FA Key prepared! Copy the developer bypass code below to access.');
        if (data.devOtp) {
          navigator.clipboard.writeText(data.devOtp).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification service went offline. Check the logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpValue || otpValue.trim().length !== 6) {
      setErrorMsg('Please input a complete 6-digit confirmation code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpValue.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'The code entered could not be verified.');
      }

      // Persist the secure device token to remember this device
      if (data.deviceToken) {
        localStorage.setItem('vault_device_token', data.deviceToken);
      }

      // Successful unlock transition
      onUnlocked();
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect verification passcode. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (sandboxOtp) {
      navigator.clipboard.writeText(sandboxOtp).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div id="email-2fa-container" className="fixed inset-0 z-50 bg-[#0A0A0C] text-white flex flex-col justify-center items-center p-6 select-none overflow-y-auto">
      {/* Visual background touches */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-zinc-900/45 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
        {/* Border micro-light effect */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        
        <div className="flex flex-col items-center text-center">
          {/* Locked Shield Icon / Transitioning to Keys */}
          <div className="p-4 bg-neutral-950 rounded-2xl ring-1 ring-zinc-850 shadow-inner mb-6 relative">
            <AnimatePresence mode="wait">
              {showOtpScreen ? (
                <motion.div
                  key="key-icon"
                  initial={{ rotate: -45, scale: 0.8, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-emerald-400"
                >
                  <KeyRound size={32} />
                </motion.div>
              ) : (
                <motion.div
                  key="shield-icon"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-zinc-400 animate-pulse"
                >
                  <Lock size={32} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Secure Web Vault
            <span className="text-[10px] py-0.5 px-2 rounded-full font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-900/30 font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={9} /> 2FA System
            </span>
          </h1>
          <p className="text-zinc-400 text-xs mt-2.5 px-4 leading-relaxed">
            {showOtpScreen 
              ? `A secure access code is required to log into ${email}` 
              : "This sandbox workspace is restricted. Only the verified system owner is authorized to proceed."}
          </p>
          {!showOtpScreen && (
            <div className="mt-4 bg-[#0d0d12] border border-zinc-800/80 p-3.5 rounded-2xl text-[11px] text-zinc-400 leading-normal max-w-sm font-sans flex items-start gap-2 text-left">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Owner Notice:</strong> To register this host device, authenticate via your 2FA email delivery or input the secure master <strong>SECURITY_PIN</strong> configured in your platform environment setup.
              </span>
            </div>
          )}
        </div>

        {/* Action Form */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            {!showOtpScreen ? (
              <motion.form 
                key="email-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSendOtp}
                className="space-y-5"
              >
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-2 font-mono">
                    Owner Email Boundary
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-650">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. owner@domain.com"
                      className="w-full bg-[#050507] border border-zinc-855 text-white rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-zinc-550 transition-colors placeholder-zinc-700 font-sans"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-bold text-sm py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all cursor-pointer shadow-lg active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin text-black" size={16} />
                  ) : (
                    <>
                      <span>Proceed with Verification</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="otp-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleVerifyOtp}
                className="space-y-5"
              >
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-2 font-mono">
                    Secure Code / Master PIN
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="Input 6-digit OTP or PIN"
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value)}
                      className="w-full bg-[#050507] border border-emerald-900/40 text-emerald-400 tracking-[3px] font-mono text-center text-md font-bold rounded-xl py-3.5 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-500">
                    Passcode valid 5m
                  </span>
                  
                  {resendTimer > 0 ? (
                    <span className="text-zinc-600 flex items-center gap-1">
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="text-zinc-400 hover:text-white cursor-pointer font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <RefreshCw size={11} />
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin text-neutral-950" size={16} />
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Unlock System Vault</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowOtpScreen(false);
                    setErrorMsg(null);
                    setInfoMsg(null);
                    setSandboxOtp(null);
                    setOtpValue('');
                  }}
                  className="w-full bg-transparent border border-zinc-850 hover:bg-zinc-900/40 text-zinc-400 hover:text-white text-xs py-3 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Back to Email Identity
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* System Error Notification Banner */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 bg-red-950/30 border border-red-900/40 p-4 rounded-xl flex items-start gap-2.5 text-xs text-red-400"
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status / Sandbox Assisted Banner */}
        <AnimatePresence>
          {infoMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 p-4 rounded-xl border text-xs leading-relaxed space-y-2 bg-emerald-950/20 border-emerald-900/30 text-emerald-400"
            >
              <p className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
                <span>{infoMsg}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Aesthetic branding footer */}
      <span className="text-zinc-700 text-[10px] tracking-widest font-mono uppercase mt-8 pointer-events-none select-none">
        Active 2FA Bounds Protocol — Sandbox Mode
      </span>
    </div>
  );
}
