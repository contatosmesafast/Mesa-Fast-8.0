import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { base44 } from '@/api/base44Client';
import { Loader2, UtensilsCrossed, User, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StaffLogin({ onLogin }) {
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const staffList = await base44.entities.Staff.filter({ login_id: loginId, is_active: true });
    
    if (staffList.length === 0) {
      setError('Usuário não encontrado ou inativo');
      setLoading(false);
      return;
    }

    const staff = staffList[0];
    
    if (staff.pin !== pin) {
      setError('PIN incorreto');
      setLoading(false);
      return;
    }

    localStorage.setItem('staff_session', JSON.stringify(staff));
    onLogin(staff);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">Acesso Funcionário</CardTitle>
          <CardDescription>Entre com suas credenciais</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="loginId" className="text-gray-700 font-medium">ID de Login</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="loginId"
                  placeholder="Seu ID de login"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="pl-11 h-12 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-gray-700 font-medium">PIN</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="pin"
                  type="password"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={4}
                  className="pl-11 h-12 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 tracking-widest text-center text-xl"
                  required
                />
              </div>
            </div>
            
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg"
              >
                {error}
              </motion.p>
            )}
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}