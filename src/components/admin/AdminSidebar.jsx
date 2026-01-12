import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Users, 
  Grid3X3,
  ClipboardList,
  Star,
  BarChart3,
  LogOut,
  ChefHat,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'AdminDashboard' },
  { icon: Grid3X3, label: 'Mesas', page: 'AdminTables' },
  { icon: UtensilsCrossed, label: 'Cardápio', page: 'AdminMenu' },
  { icon: Users, label: 'Funcionários', page: 'AdminStaff' },
  { icon: BarChart3, label: 'Relatórios', page: 'AdminReports' },
  { icon: DollarSign, label: 'Faturamento', page: 'AdminBilling' },
];

export default function AdminSidebar({ restaurant, onLogout }) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="w-64 bg-gradient-to-b from-emerald-900 to-emerald-950 min-h-screen flex flex-col">
      <div className="p-6 border-b border-emerald-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight truncate max-w-[140px]">
              {restaurant?.name || 'Restaurante'}
            </h1>
            <p className="text-emerald-400 text-xs">Painel Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentPath.includes(item.page);
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-700/50 text-white'
                  : 'text-emerald-300 hover:text-white hover:bg-emerald-800/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 bg-amber-400 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-emerald-800/50">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-300 hover:text-white hover:bg-red-500/20 w-full transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}