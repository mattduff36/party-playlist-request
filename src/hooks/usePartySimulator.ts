/**
 * Client-side party simulator hook.
 * Subscribes to a module-level singleton so the runner and stats survive
 * SPA navigations while the browser tab stays open.
 */

import { useState, useEffect, useCallback } from 'react';
import { SimulationConfig, SimulationStats } from '@/lib/party-simulator-shared';
import { clientPartySimulator } from '@/lib/party-simulator-client';

export function usePartySimulator() {
  const [stats, setStats] = useState<SimulationStats>(() =>
    clientPartySimulator.getStats()
  );

  useEffect(() => {
    return clientPartySimulator.subscribe(setStats);
  }, []);

  const startSimulation = useCallback((config: SimulationConfig) => {
    clientPartySimulator.start(config);
  }, []);

  const stopSimulation = useCallback(() => {
    clientPartySimulator.stop();
  }, []);

  const triggerManualRequest = useCallback(async () => {
    await clientPartySimulator.triggerManualRequest();
  }, []);

  const triggerManualBurst = useCallback(async () => {
    await clientPartySimulator.triggerManualBurst();
  }, []);

  const getRunningConfig = useCallback((): SimulationConfig | null => {
    return clientPartySimulator.getConfig();
  }, []);

  return {
    stats,
    startSimulation,
    stopSimulation,
    triggerManualRequest,
    triggerManualBurst,
    getRunningConfig,
  };
}
