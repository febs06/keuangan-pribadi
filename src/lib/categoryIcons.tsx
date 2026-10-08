import React from 'react';
import {
  Utensils,
  Coffee,
  Car,
  Bike,
  ShoppingBag,
  Home,
  Receipt,
  Zap,
  Gamepad2,
  HeartPulse,
  GraduationCap,
  CreditCard,
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowLeftRight,
  Tag,
  Package
} from 'lucide-react';

export interface CategoryStyle {
  icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  color: string;
  bgColor: string;
}

export function getCategoryStyle(name: string = '', type: 'expense' | 'income' | 'transfer' = 'expense'): CategoryStyle {
  const lower = name.toLowerCase().trim();

  if (type === 'transfer') {
    return {
      icon: ArrowLeftRight,
      color: '#2563eb',
      bgColor: 'rgba(37, 99, 235, 0.12)'
    };
  }

  if (type === 'income') {
    if (lower.includes('gaji')) {
      return { icon: Wallet, color: '#059669', bgColor: 'rgba(5, 150, 105, 0.12)' };
    }
    if (lower.includes('invest') || lower.includes('dividen') || lower.includes('bunga')) {
      return { icon: TrendingUp, color: '#059669', bgColor: 'rgba(5, 150, 105, 0.12)' };
    }
    return {
      icon: ArrowDownLeft,
      color: '#059669',
      bgColor: 'rgba(5, 150, 105, 0.12)'
    };
  }

  // Pengeluaran (Expense)
  if (lower.includes('makan') || lower.includes('food') || lower.includes('restoran')) {
    return { icon: Utensils, color: '#ea580c', bgColor: 'rgba(234, 88, 12, 0.12)' };
  }
  if (lower.includes('jajan') || lower.includes('kopi') || lower.includes('snack') || lower.includes('minum')) {
    return { icon: Coffee, color: '#d97706', bgColor: 'rgba(217, 119, 6, 0.12)' };
  }
  if (lower.includes('transport') || lower.includes('bensin') || lower.includes('ojol') || lower.includes('parkir')) {
    return { icon: Car, color: '#0284c7', bgColor: 'rgba(2, 132, 199, 0.12)' };
  }
  if (lower.includes('motor') || lower.includes('sepeda')) {
    return { icon: Bike, color: '#0284c7', bgColor: 'rgba(2, 132, 199, 0.12)' };
  }
  if (lower.includes('belanja') || lower.includes('shop') || lower.includes('baju')) {
    return { icon: ShoppingBag, color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.12)' };
  }
  if (lower.includes('kebutuhan') || lower.includes('pokok') || lower.includes('pasar') || lower.includes('groceries')) {
    return { icon: Package, color: '#4f46e5', bgColor: 'rgba(79, 70, 229, 0.12)' };
  }
  if (lower.includes('rumah') || lower.includes('kos') || lower.includes('sewa')) {
    return { icon: Home, color: '#0d9488', bgColor: 'rgba(13, 148, 136, 0.12)' };
  }
  if (lower.includes('tagihan') || lower.includes('bill') || lower.includes('cicilan')) {
    return { icon: Receipt, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.12)' };
  }
  if (lower.includes('listrik') || lower.includes('air') || lower.includes('wifi') || lower.includes('pulsa') || lower.includes('kuota')) {
    return { icon: Zap, color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.12)' };
  }
  if (lower.includes('hiburan') || lower.includes('game') || lower.includes('nonton') || lower.includes('film')) {
    return { icon: Gamepad2, color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.12)' };
  }
  if (lower.includes('sehat') || lower.includes('obat') || lower.includes('dokter') || lower.includes('klinik')) {
    return { icon: HeartPulse, color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.12)' };
  }
  if (lower.includes('didik') || lower.includes('kuliah') || lower.includes('sekolah') || lower.includes('buku') || lower.includes('kursus')) {
    return { icon: GraduationCap, color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.12)' };
  }
  if (lower.includes('admin') || lower.includes('bank') || lower.includes('pajak')) {
    return { icon: CreditCard, color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.12)' };
  }

  return {
    icon: Tag,
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.1)'
  };
}
