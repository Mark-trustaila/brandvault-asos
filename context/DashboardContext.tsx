'use client';
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Trademark, TrademarkData } from '../types/trademark';
import { matchesSearch } from '../lib/utils';

interface DashboardContextType {
  data: TrademarkData | null;
  setData: (data: TrademarkData) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pipelineFilter: string | null;
  setPipelineFilter: (f: string | null) => void;
  selectedTrademark: Trademark | null;
  setSelectedTrademark: (t: Trademark | null) => void;
  showReport: boolean;
  setShowReport: (s: boolean) => void;
  editTarget: Trademark | 'new' | null; // open the edit form (existing mark or a new one)
  setEditTarget: (t: Trademark | 'new' | null) => void;
  filteredTrademarks: Trademark[];
  focusedMark: string | null;
  setFocusedMark: (mark: string | null) => void;
  breeOpen: boolean;
  setBreeOpen: (open: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<TrademarkData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('actions');
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);
  const [selectedTrademark, setSelectedTrademark] = useState<Trademark | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [focusedMark, setFocusedMark] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Trademark | 'new' | null>(null);
  const [breeOpen, setBreeOpen] = useState(false);

  const filteredTrademarks = useMemo(
    () => data?.trademarks.filter(t => matchesSearch(t, searchQuery)) ?? [],
    [data, searchQuery]
  );

  return (
    <DashboardContext.Provider value={{
      data, setData, searchQuery, setSearchQuery,
      activeTab, setActiveTab,
      pipelineFilter, setPipelineFilter,
      selectedTrademark, setSelectedTrademark,
      showReport, setShowReport,
      editTarget, setEditTarget,
      filteredTrademarks,
      focusedMark, setFocusedMark,
      breeOpen, setBreeOpen,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};
