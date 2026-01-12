import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from '@/api/base44Client';
import { UtensilsCrossed, Shield, ChefHat, Users, User, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function Home() {
  const [view, setView] = useState('select'); // 'select', 'staff', 'admin-setup'
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    // Check staff session
    const staffSession = localStorage.getItem('staff_session');
    if (staffSession) {
      const staff = JSON.parse(staffSession);
      // Verify staff still exists and is active
      const staffList = await base44.entities.Staff.filter({ id: staff.id, is_active: true });
      if (staffList.length > 0) {
        redirectByRole(staff.role);
        return;
      } else {
        localStorage.removeItem('staff_session');
      }
    }

    // Check admin (Base44 auth)
    const isAuth = await base44.auth.isAuthenticated();
    if (isAuth) {
      const user = await base44.auth.me();
      
      // Check if super admin
      const SUPER_ADMIN_EMAIL = 'matheussouza49009@gmail.com'; // ALTERE PARA SEU EMAIL
      if (user.email === SUPER_ADMIN_EMAIL) {
        window.location.href = createPageUrl('SuperAdmin');
        return;
      }
      
      const staffList = await base44.entities.Staff.filter({ user_email: user.email, role: 'ADMIN', is_active: true });
      if (staffList.length > 0) {
        localStorage.setItem('staff_session', JSON.stringify(staffList[0]));
        window.location.href = createPageUrl('AdminDashboard');
        return;
      }
      // Admin logged in but no restaurant yet - show setup
      setView('admin-setup');
    }
    
    setIsCheckingAuth(false);
  };

  const redirectByRole = (role) => {
    switch (role) {
      case 'ADMIN':
        window.location.href = createPageUrl('AdminDashboard');
        break;
      case 'WAITER':
        window.location.href = createPageUrl('WaiterDashboard');
        break;
      default:
        break;
    }
  };

  const handleStaffLogin = async (e) => {
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
    redirectByRole(staff.role);
    setLoading(false);
  };

  const handleAdminLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('Home'));
  };

  const handleSetupRestaurant = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const user = await base44.auth.me();
    const restaurantName = e.target.restaurantName.value;
    
    // Create restaurant
    const restaurant = await base44.entities.Restaurant.create({
      name: restaurantName,
      owner_email: user.email,
      is_active: true,
    });
    
    // Create admin staff
    const adminStaff = await base44.entities.Staff.create({
      restaurant_id: restaurant.id,
      name: user.full_name || 'Administrador',
      role: 'ADMIN',
      login_id: 'ADMIN',
      pin: '0000',
      user_email: user.email,
      is_active: true,
    });
    
    // Create 50 tables
    const tablePromises = [];
    for (let i = 1; i <= 50; i++) {
      tablePromises.push(
        base44.entities.Table.create({
          restaurant_id: restaurant.id,
          number: i,
          status: 'LIVRE',
        })
      );
    }
    await Promise.all(tablePromises);
    
    // Create sample categories
    const categories = ['Entradas', 'Pratos Principais', 'Bebidas', 'Sobremesas'];
    for (const cat of categories) {
      await base44.entities.MenuCategory.create({
        restaurant_id: restaurant.id,
        name: cat,
        order: categories.indexOf(cat),
        is_active: true,
      });
    }
    
    localStorage.setItem('staff_session', JSON.stringify(adminStaff));
    window.location.href = createPageUrl('AdminDashboard');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <UtensilsCrossed className="w-12 h-12 text-amber-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">
          {view === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
                >
                  <UtensilsCrossed className="w-10 h-10 text-white" />
                </motion.div>
                <h1 className="text-4xl font-bold text-white mb-2">ComandaFácil</h1>
                <p className="text-emerald-200">Sistema de Gestão de Restaurante</p>
              </div>

              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl font-semibold text-gray-800">Selecione seu perfil</CardTitle>
                  <CardDescription>Como deseja acessar o sistema?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <Button
                    onClick={handleAdminLogin}
                    variant="outline"
                    className="w-full h-16 border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                  >
                    <Shield className="w-6 h-6 mr-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-800">Administrador</p>
                      <p className="text-xs text-gray-500">Gestão completa do restaurante</p>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={() => setView('staff')}
                    variant="outline"
                    className="w-full h-16 border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 transition-all group"
                  >
                    <Users className="w-6 h-6 mr-3 text-amber-600 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-800">Funcionário</p>
                      <p className="text-xs text-gray-500">Garçom ou Cozinha</p>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'staff' && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Button
                variant="ghost"
                onClick={() => { setView('select'); setError(''); }}
                className="text-white hover:text-amber-400 mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <UtensilsCrossed className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-800">Acesso Funcionário</CardTitle>
                  <CardDescription>Entre com suas credenciais</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleStaffLogin} className="space-y-5">
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
          )}

          {view === 'admin-setup' && (
            <motion.div
              key="admin-setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Button
                variant="ghost"
                onClick={async () => {
                  await base44.auth.logout();
                  window.location.reload();
                }}
                className="text-white hover:text-amber-400 mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Sair e voltar
              </Button>
              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <ChefHat className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-800">Configurar Restaurante</CardTitle>
                  <CardDescription>Vamos criar seu restaurante!</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSetupRestaurant} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="restaurantName" className="text-gray-700 font-medium">Nome do Restaurante</Label>
                      <Input
                        id="restaurantName"
                        name="restaurantName"
                        placeholder="Ex: Restaurante Bom Sabor"
                        className="h-12 border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                        required
                      />
                    </div>
                    
                    <div className="bg-amber-50 p-4 rounded-lg text-sm text-amber-800">
                      <p className="font-medium mb-2">O que será criado:</p>
                      <ul className="list-disc list-inside space-y-1 text-amber-700">
                        <li>50 mesas pré-cadastradas</li>
                        <li>Categorias iniciais do cardápio</li>
                        <li>Seu acesso de administrador</li>
                      </ul>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Criar Meu Restaurante'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}