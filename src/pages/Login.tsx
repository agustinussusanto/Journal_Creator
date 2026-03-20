import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, ShieldCheck, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { hashOTP } from '../lib/crypto';
import emailjs from '@emailjs/browser';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type Step = 'EMAIL' | 'OTP' | 'SUCCESS';

export default function Login() {
  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'OTP' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Check if email is in whitelist
      const emailDoc = await getDoc(doc(db, 'allowed_emails', email.toLowerCase().trim()));
      
      if (!emailDoc.exists()) {
        setError('Email not registered. Please contact your administrator.');
        setIsLoading(false);
        return;
      }

      // 1.5 Rate Limiting Check
      const rateLimitRef = doc(db, 'rate_limits', email.toLowerCase().trim());
      const rateLimitDoc = await getDoc(rateLimitRef);
      const now = Date.now();
      
      if (rateLimitDoc.exists()) {
        const data = rateLimitDoc.data();
        if (now - data.lastRequest < 60000) {
          if (data.count >= 3) {
            setError('Too many requests. Please wait a minute before trying again.');
            setIsLoading(false);
            return;
          }
          await setDoc(rateLimitRef, { count: data.count + 1, lastRequest: data.lastRequest });
        } else {
          await setDoc(rateLimitRef, { count: 1, lastRequest: now });
        }
      } else {
        await setDoc(rateLimitRef, { count: 1, lastRequest: now });
      }

      // 2. Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 3. Hash OTP and save to Firestore
      const hashedOtp = await hashOTP(email, generatedOtp);
      await setDoc(doc(db, 'otp_codes', hashedOtp), {
        email: email.toLowerCase().trim(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        used: false
      });

      // 4. Send email via EmailJS
      const serviceId = process.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = process.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.VITE_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        console.warn(`Your OTP is: ${generatedOtp}`);
        setError(`Your OTP is: ${generatedOtp}`);
      } else {
        try {
          await emailjs.send(
            serviceId,
            templateId,
            {
              to_email: email,
              otp_code: generatedOtp,
            },
            publicKey
          );
        } catch (emailErr: any) {
          console.error('EmailJS Error:', emailErr);
          console.warn(`Your OTP is: ${generatedOtp}`);
          setError(`Your OTP is: ${generatedOtp}`);
        }
      }

      setStep('OTP');
      setCountdown(60);
    } catch (err: any) {
      console.error('OTP Error:', err);
      const errorMessage = err?.text || err?.message || 'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const hashedOtp = await hashOTP(email, otp);
      const otpRef = doc(db, 'otp_codes', hashedOtp);
      const otpDoc = await getDoc(otpRef);

      if (!otpDoc.exists()) {
        setError('Invalid OTP code');
        setIsLoading(false);
        return;
      }

      const data = otpDoc.data();

      if (data.used) {
        setError('This code has already been used');
        setIsLoading(false);
        return;
      }

      if (Date.now() > data.expiresAt) {
        setError('This code has expired. Please request a new one.');
        setIsLoading(false);
        return;
      }

      // Valid OTP!
      await updateDoc(otpRef, { used: true });
      
      setStep('SUCCESS');
      localStorage.setItem('user_session', email.toLowerCase().trim());
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError('Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-8 relative z-10"
      >
        <div className="mb-8 text-center">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-2">Sign in securely without a password.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'EMAIL' && (
            <motion.form 
              key="email-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendOTP}
              className="space-y-5"
            >
              <Input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-5 h-5" />}
                error={error}
                autoFocus
                required
              />
              <Button 
                type="submit" 
                className="w-full" 
                isLoading={isLoading}
              >
                Continue with Email
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.form>
          )}

          {step === 'OTP' && (
            <motion.form 
              key="otp-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerifyOTP}
              className="space-y-5"
            >
              <div className="text-center mb-6">
                <p className="text-sm text-slate-600">
                  We sent a 6-digit code to <br/>
                  <span className="font-medium text-slate-900">{email}</span>
                </p>
              </div>
              <Input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                icon={<KeyRound className="w-5 h-5" />}
                error={error}
                className="text-center tracking-[0.5em] text-lg font-medium"
                required
              />
              <Button 
                type="submit" 
                className="w-full" 
                isLoading={isLoading}
              >
                Verify & Login
              </Button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={countdown > 0 || isLoading}
                  className="text-sm text-indigo-600 font-medium hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </button>
              </div>
            </motion.form>
          )}

          {step === 'SUCCESS' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </motion.div>
              <h2 className="text-xl font-medium text-slate-900">Verified Successfully</h2>
              <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
