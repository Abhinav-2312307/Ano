import { preloadStreetRushGLB } from '@/components/games/street-rush/components/StreetRushVehicleBuilder';
import { CAR_SPECS } from '@/components/games/street-rush/config/carConfig';

export interface StreetRushPreloadState {
  total: number;
  loaded: number;
  failed: number;
  progress: number;
  isReady: boolean;
  isError: boolean;
  failedAssets: string[];
}

type Listener = (state: StreetRushPreloadState) => void;

class StreetRushAssetPreloader {
  private state: StreetRushPreloadState = {
    total: Object.keys(CAR_SPECS).length,
    loaded: 0,
    failed: 0,
    progress: 0,
    isReady: false,
    isError: false,
    failedAssets: [],
  };

  private listeners: Set<Listener> = new Set();
  private isPreloadingStarted = false;

  public getState(): StreetRushPreloadState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public async startPreload() {
    if (typeof window === 'undefined') return;

    if (this.state.isReady) {
      this.notify();
      return;
    }

    if (this.isPreloadingStarted && !this.state.isError) {
      return;
    }

    this.isPreloadingStarted = true;
    this.state.isError = false;
    this.state.failed = 0;
    this.state.failedAssets = [];
    this.notify();

    const carEntries = Object.keys(CAR_SPECS);
    this.state.total = carEntries.length;

    let loadedCount = 0;

    const loadPromises = carEntries.map(async (carId) => {
      try {
        await preloadStreetRushGLB(carId);
        loadedCount += 1;
        this.state.loaded = loadedCount;
        this.state.progress = Math.min(100, Math.round((loadedCount / this.state.total) * 100));
        this.notify();
      } catch {
        // Fallback procedural chassis ensures gameplay always works
        loadedCount += 1;
        this.state.loaded = loadedCount;
        this.state.progress = Math.min(100, Math.round((loadedCount / this.state.total) * 100));
        this.notify();
      }
    });

    await Promise.all(loadPromises);

    this.state.loaded = this.state.total;
    this.state.progress = 100;
    this.state.isReady = true;
    this.state.isError = false;
    this.notify();
  }

  public retry() {
    this.isPreloadingStarted = false;
    this.startPreload();
  }
}

export const streetRushAssetPreloader = new StreetRushAssetPreloader();
