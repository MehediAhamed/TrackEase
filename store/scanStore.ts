import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Scan, ScanResult, ScanStatus } from '../types';

const STORAGE_KEY = 'trackease:scans';
const MAX_HISTORY = 100;

interface ScanStore {
  scans: Scan[];
  /** Create a new scan record and return it */
  createScan: (photoUri: string) => Scan;
  /** Update the status and result of an existing scan */
  updateScan: (id: string, status: ScanStatus, result?: ScanResult, error?: string) => void;
  /** Add a tag to a scan */
  addTag: (id: string, tag: string) => void;
  /** Remove a tag from a scan */
  removeTag: (id: string, tag: string) => void;
  /** Delete a scan from history */
  deleteScan: (id: string) => void;
  /** Load persisted scans from AsyncStorage */
  loadScans: () => Promise<void>;
  /** Get a single scan by ID */
  getScan: (id: string) => Scan | undefined;
}

function generateId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persist(scans: Scan[]) {
  try {
    // Only persist completed or errored scans (not in-progress)
    const toStore = scans
      .filter((s) => s.status !== 'scanning')
      .slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Silently ignore storage errors
  }
}

export const useScanStore = create<ScanStore>((set, get) => ({
  scans: [],

  createScan: (photoUri) => {
    const scan: Scan = {
      id: generateId(),
      photoUri,
      timestamp: Date.now(),
      status: 'scanning',
      tags: [],
    };
    set((state) => ({ scans: [scan, ...state.scans] }));
    return scan;
  },

  updateScan: (id, status, result, error) => {
    set((state) => {
      const scans = state.scans.map((s) =>
        s.id === id ? { ...s, status, result, error } : s
      );
      persist(scans);
      return { scans };
    });
  },

  addTag: (id, tag) => {
    set((state) => {
      const scans = state.scans.map((s) =>
        s.id === id && !s.tags.includes(tag)
          ? { ...s, tags: [...s.tags, tag] }
          : s
      );
      persist(scans);
      return { scans };
    });
  },

  removeTag: (id, tag) => {
    set((state) => {
      const scans = state.scans.map((s) =>
        s.id === id ? { ...s, tags: s.tags.filter((t) => t !== tag) } : s
      );
      persist(scans);
      return { scans };
    });
  },

  deleteScan: (id) => {
    set((state) => {
      const scans = state.scans.filter((s) => s.id !== id);
      persist(scans);
      return { scans };
    });
  },

  loadScans: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const scans: Scan[] = JSON.parse(raw);
        set({ scans });
      }
    } catch {
      // Ignore parse errors
    }
  },

  getScan: (id) => get().scans.find((s) => s.id === id),
}));
