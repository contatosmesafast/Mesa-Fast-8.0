import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BlockedAccount({ reason }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl bg-white">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Conta Bloqueada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Esta conta foi temporariamente bloqueada.
            </p>
            
            {reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Motivo:</p>
                <p className="text-red-700 mt-1">{reason}</p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <p className="text-gray-600 text-sm mb-3">
                Entre em contato para regularizar sua situação:
              </p>
              <a
                href="mailto:suporte@comandafacil.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all"
              >
                <Mail className="w-5 h-5" />
                Entrar em Contato
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}