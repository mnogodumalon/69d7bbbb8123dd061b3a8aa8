import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bestellrunde, Bestellung, Gerichte } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [bestellrunde, setBestellrunde] = useState<Bestellrunde[]>([]);
  const [bestellung, setBestellung] = useState<Bestellung[]>([]);
  const [gerichte, setGerichte] = useState<Gerichte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [bestellrundeData, bestellungData, gerichteData] = await Promise.all([
        LivingAppsService.getBestellrunde(),
        LivingAppsService.getBestellung(),
        LivingAppsService.getGerichte(),
      ]);
      setBestellrunde(bestellrundeData);
      setBestellung(bestellungData);
      setGerichte(gerichteData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [bestellrundeData, bestellungData, gerichteData] = await Promise.all([
          LivingAppsService.getBestellrunde(),
          LivingAppsService.getBestellung(),
          LivingAppsService.getGerichte(),
        ]);
        setBestellrunde(bestellrundeData);
        setBestellung(bestellungData);
        setGerichte(gerichteData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const bestellrundeMap = useMemo(() => {
    const m = new Map<string, Bestellrunde>();
    bestellrunde.forEach(r => m.set(r.record_id, r));
    return m;
  }, [bestellrunde]);

  const gerichteMap = useMemo(() => {
    const m = new Map<string, Gerichte>();
    gerichte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [gerichte]);

  return { bestellrunde, setBestellrunde, bestellung, setBestellung, gerichte, setGerichte, loading, error, fetchAll, bestellrundeMap, gerichteMap };
}