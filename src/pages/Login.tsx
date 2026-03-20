import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, ShieldCheck, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { hashOTP } from '../lib/crypto';
import emailjs from '@emailjs/browser';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type Step = 'EMAIL' | 'OTP' | 'SUCCESS';

export default function Login() {
  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const isAdminEmail = email.toLowerCase().trim() === 'agustinus.id01@gmail.com';
      
      // Primary admin recovery/default access
      if (isAdminEmail && password === 'admin123') {
        localStorage.setItem('user_session', email.toLowerCase().trim());
        setStep('SUCCESS');
        setTimeout(() => navigate('/dashboard'), 1500);
        return;
      }

      const emailDoc = await getDoc(doc(db, 'allowed_emails', email.toLowerCase().trim()));
      
      if (!emailDoc.exists()) {
        setError('Email not registered or incorrect password.');
        setIsLoading(false);
        return;
      }

      const userData = emailDoc.data();
      if (userData.password !== password) {
        setError('Incorrect password.');
        setIsLoading(false);
        return;
      }

      // Valid Login!
      localStorage.setItem('user_session', email.toLowerCase().trim());
      setStep('SUCCESS');
      setTimeout(() => navigate('/dashboard'), 1500);

    } catch (err: any) {
      console.error('Login Error:', err);
      setError('Failed to login. Please check your connection.');
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
          <p className="text-sm text-slate-500 mt-2">Sign in to your research dashboard.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'EMAIL' && (
            <motion.form 
              key="login-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleLogin}
              className="space-y-5"
            >
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-5 h-5" />}
                autoFocus
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<KeyRound className="w-5 h-5" />}
                error={error}
                required
              />
              <Button 
                type="submit" 
                className="w-full" 
                isLoading={isLoading}
              >
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-slate-400 mt-4">
                Default admin password is <strong>admin123</strong>
              </p>
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
              <h2 className="text-xl font-medium text-slate-900">Login Successful</h2>
              <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
