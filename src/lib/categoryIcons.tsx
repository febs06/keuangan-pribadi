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
      color: '#38bdf8',
      bgColor: 'rgba(56, 189, 248, 0.08)'
    };
  }

  if (type === 'income') {
    if (lower.includes('gaji')) {
      return { icon: Wallet, color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.08)' };
    }
    if (lower.includes('invest') || lower.includes('dividen') || lower.includes('bunga')) {
      return { icon: TrendingUp, color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.08)' };
    }
    return {
      icon: ArrowDownLeft,
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.08)'
    };
  }

  // Pengeluaran (Expense) - Muted Mineral & Earthy Pigments
  if (lower.includes('makan') || lower.includes('food') || lower.includes('restoran')) {
    return { icon: Utensils, color: '#fb923c', bgColor: 'rgba(251, 146, 60, 0.08)' };
  }
  if (lower.includes('jajan') || lower.includes('kopi') || lower.includes('snack') || lower.includes('minum')) {
    return { icon: Coffee, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.08)' };
  }
  if (lower.includes('transport') || lower.includes('bensin') || lower.includes('ojol') || lower.includes('parkir')) {
    return { icon: Car, color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.08)' };
  }
  if (lower.includes('motor') || lower.includes('sepeda')) {
    return { icon: Bike, color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.08)' };
  }
  if (lower.includes('belanja') || lower.includes('shop') || lower.includes('baju')) {
    return { icon: ShoppingBag, color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.08)' };
  }
  if (lower.includes('kebutuhan') || lower.includes('pokok') || lower.includes('pasar') || lower.includes('groceries')) {
    return { icon: Package, color: '#818cf8', bgColor: 'rgba(129, 140, 248, 0.08)' };
  }
  if (lower.includes('rumah') || lower.includes('kos') || lower.includes('sewa')) {
    return { icon: Home, color: '#2dd4bf', bgColor: 'rgba(45, 212, 191, 0.08)' };
  }
  if (lower.includes('tagihan') || lower.includes('bill') || lower.includes('cicilan')) {
    return { icon: Receipt, color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.08)' };
  }
  if (lower.includes('listrik') || lower.includes('air') || lower.includes('wifi') || lower.includes('pulsa') || lower.includes('kuota')) {
    return { icon: Zap, color: '#facc15', bgColor: 'rgba(250, 204, 21, 0.08)' };
  }
  if (lower.includes('hiburan') || lower.includes('game') || lower.includes('nonton') || lower.includes('film')) {
    return { icon: Gamepad2, color: '#f472b6', bgColor: 'rgba(244, 114, 182, 0.08)' };
  }
  if (lower.includes('sehat') || lower.includes('obat') || lower.includes('dokter') || lower.includes('klinik')) {
    return { icon: HeartPulse, color: '#f87171', bgColor: 'rgba(248, 113, 113, 0.08)' };
  }
  if (lower.includes('didik') || lower.includes('kuliah') || lower.includes('sekolah') || lower.includes('buku') || lower.includes('kursus')) {
    return { icon: GraduationCap, color: '#2dd4bf', bgColor: 'rgba(45, 212, 191, 0.08)' };
  }
  if (lower.includes('admin') || lower.includes('bank') || lower.includes('pajak')) {
    return { icon: CreditCard, color: '#94a3b8', bgColor: 'rgba(148, 163, 184, 0.08)' };
  }

  return {
    icon: Tag,
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.08)'
  };
}
