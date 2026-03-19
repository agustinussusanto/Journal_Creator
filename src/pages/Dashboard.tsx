import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, LayoutDashboard, User } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (!session) {
      navigate('/login');
    } else {
      setUserEmail(session);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    navigate('/login');
  };

  if (!userEmail) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-sm">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                {userEmail}
              </div>
              <Button variant="ghost" onClick={handleLogout} className="text-slate-600 hover:text-slate-900">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center"
        >
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-4 tracking-tight">Welcome to your workspace</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            You have successfully logged in using a secure, passwordless authentication flow. 
            This is your private dashboard area.
          </p>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 mb-4 flex items-center justify-center text-indigo-600 font-semibold">
                  0{i}
                </div>
                <h3 className="font-medium text-slate-900 mb-2">Feature Module</h3>
                <p className="text-sm text-slate-500">Explore the capabilities of this modern SaaS application template.</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
