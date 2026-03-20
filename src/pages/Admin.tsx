import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, LogOut, Plus, Trash2, Users, Mail, Loader2, KeyRound } from 'lucide-react';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface AllowedEmail {
  email: string;
  password?: string;
  addedAt: string;
}

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        try {
          const adminPath = `admins/${user.email}`;
          let adminDoc;
          try {
            adminDoc = await getDoc(doc(db, 'admins', user.email));
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, adminPath);
            return;
          }
          if (adminDoc.exists()) {
            setIsAdmin(true);
            fetchEmails();
          } else {
            setIsAdmin(false);
            await signOut(auth);
            setError('You do not have administrator privileges.');
          }
        } catch (err) {
          console.error(err);
          setIsAdmin(false);
          setError('Failed to verify admin status.');
        }
      } else {
        setIsAdmin(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchEmails = async () => {
    try {
      const path = 'allowed_emails';
      let querySnapshot;
      try {
        querySnapshot = await getDocs(collection(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
        return;
      }
      const fetchedEmails: AllowedEmail[] = [];
      querySnapshot.forEach((doc) => {
        fetchedEmails.push(doc.data() as AllowedEmail);
      });
      setEmails(fetchedEmails.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch allowed emails.');
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in.');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsAdding(true);
    setError('');

    try {
      const emailLower = newEmail.toLowerCase().trim();
      const path = `allowed_emails/${emailLower}`;
      try {
        await setDoc(doc(db, 'allowed_emails', emailLower), {
          email: emailLower,
          password: newPassword,
          addedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
        return;
      }
      setNewEmail('');
      setNewPassword('');
      await fetchEmails();
    } catch (err: any) {
      console.error(err);
      setError('Failed to add email. Ensure you have admin permissions.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteEmail = async (emailToDelete: string) => {
    if (!window.confirm(`Are you sure you want to remove ${emailToDelete}?`)) return;
    
    try {
      const path = `allowed_emails/${emailToDelete}`;
      try {
        await deleteDoc(doc(db, 'allowed_emails', emailToDelete));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
        return;
      }
      await fetchEmails();
    } catch (err) {
      console.error(err);
      setError('Failed to delete email.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Admin Access Required</h1>
          <p className="text-slate-500 mb-8">Please sign in with an authorized Google account to manage the whitelist.</p>
          
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          
          <Button onClick={handleLogin} className="w-full">
            Sign in with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Whitelist Manager</h1>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-slate-500 hover:text-slate-900">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Add Email Form */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Add New User</h2>
              <form onSubmit={handleAddEmail} className="space-y-4">
                <Input
                  type="email"
                  placeholder="user@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<KeyRound className="w-4 h-4" />}
                  required
                />
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <Button type="submit" className="w-full" isLoading={isAdding}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Whitelist
                </Button>
              </form>
            </div>
          </div>

          {/* Email List */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Allowed Emails</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {emails.length} Users
                </span>
              </div>
              
              <ul className="divide-y divide-slate-100">
                {emails.length === 0 ? (
                  <li className="p-8 text-center text-slate-500">
                    No emails in the whitelist yet.
                  </li>
                ) : (
                  emails.map((item) => (
                    <motion.li 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={item.email} 
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-medium text-sm">
                          {item.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.email}</p>
                          <p className="text-xs text-slate-500">Password: {item.password || 'Not set'}</p>
                          <p className="text-xs text-slate-500">Added {new Date(item.addedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEmail(item.email)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.li>
                  ))
                )}
              </ul>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
