import type {
  AiDraftResponse,
  AiSearchResponse,
  ApplyPlanResponse,
  ApprovalQueue,
  BookingView,
  Catalog,
  ConflictExplanation,
  CreateBookingInput,
  CreateBookingResponse,
  DecisionInput,
  EquipmentDetail,
  InsightsResponse,
  Persona,
  SessionInfo,
  UtilisationReport,
} from '@lablink/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './api';

/** Centralised query keys keep cache invalidation consistent. */
export const keys = {
  session: ['session'] as const,
  personas: ['personas'] as const,
  catalog: ['catalog'] as const,
  equipment: (id: string, from?: string) => ['equipment', id, from ?? 'today'] as const,
  myBookings: ['bookings', 'mine'] as const,
  approvals: ['approvals'] as const,
  utilisation: ['insights', 'utilisation'] as const,
  recommendations: ['insights', 'recommendations'] as const,
};

const STATIC = { staleTime: 5 * 60_000 };

export const useSession = () =>
  useQuery({ queryKey: keys.session, queryFn: () => api.get<SessionInfo>('/session') });
export const usePersonas = () =>
  useQuery({ queryKey: keys.personas, queryFn: () => api.get<Persona[]>('/personas'), ...STATIC });
export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: () => api.get<Catalog>('/catalog'), ...STATIC });

/** O(1) lookups over the catalogue, memoised per fetch. */
export function useCatalogIndex() {
  const { data } = useCatalog();
  return useMemo(() => {
    const equipment = new Map(data?.equipment.map((e) => [e.id, e]));
    const labs = new Map(data?.labs.map((l) => [l.id, l]));
    const departments = new Map(data?.departments.map((d) => [d.id, d]));
    return { equipment, labs, departments };
  }, [data]);
}

export const useEquipmentDetail = (id: string, from?: string) =>
  useQuery({
    queryKey: keys.equipment(id, from),
    queryFn: () =>
      api.get<EquipmentDetail>(
        `/equipment/${encodeURIComponent(id)}${from ? `?from=${from}` : ''}`,
      ),
    // Keep the previous week visible while the next one loads (no layout flash).
    placeholderData: (previous) => previous,
  });

export const useMyBookings = (enabled: boolean) =>
  useQuery({
    queryKey: keys.myBookings,
    queryFn: () => api.get<BookingView[]>('/bookings/mine'),
    enabled,
  });

export const useApprovals = (enabled: boolean) =>
  useQuery({
    queryKey: keys.approvals,
    queryFn: () => api.get<ApprovalQueue>('/approvals'),
    enabled,
  });

export const useUtilisation = (enabled: boolean) =>
  useQuery({
    queryKey: keys.utilisation,
    queryFn: () => api.get<UtilisationReport>('/insights/utilisation'),
    enabled,
  });

export const useRecommendations = (enabled: boolean) =>
  useQuery({
    queryKey: keys.recommendations,
    queryFn: () => api.get<InsightsResponse>('/insights/recommendations'),
    enabled,
    staleTime: 2 * 60_000,
  });

export function useSwitchPersona() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post<SessionInfo>('/session', { personaId }),
    onSuccess: (data) => {
      client.setQueryData(keys.session, data);
      // Everything except reference data is persona-specific.
      void client.invalidateQueries({
        predicate: (q) => !['catalog', 'personas', 'session'].includes(String(q.queryKey[0])),
      });
    },
  });
}

/** Booking changes affect calendars, personal lists, queues and analytics. */
function useInvalidateBookingData() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [['equipment'], keys.myBookings, keys.approvals, ['insights']].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookingData();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.post<CreateBookingResponse>('/bookings', input),
    onSuccess: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateBookingData();
  return useMutation({
    mutationFn: (id: string) => api.post<BookingView>(`/bookings/${encodeURIComponent(id)}/cancel`),
    onSuccess: invalidate,
  });
}

export function useDecision() {
  const invalidate = useInvalidateBookingData();
  return useMutation({
    mutationFn: ({ id, ...input }: DecisionInput & { id: string }) =>
      api.post<BookingView>(`/approvals/${encodeURIComponent(id)}/decision`, input),
    onSuccess: invalidate,
  });
}

export function useApplyPlan() {
  const invalidate = useInvalidateBookingData();
  return useMutation({
    mutationFn: (conflictId: string) =>
      api.post<ApplyPlanResponse>(`/conflicts/${encodeURIComponent(conflictId)}/apply`),
    onSuccess: invalidate,
  });
}

export const useExplainConflict = () =>
  useMutation({
    mutationFn: (conflictId: string) =>
      api.post<ConflictExplanation>(`/conflicts/${encodeURIComponent(conflictId)}/explain`),
  });

export const useAiSearch = () =>
  useMutation({
    mutationFn: (query: string) => api.post<AiSearchResponse>('/ai/search', { query }),
  });

export const useAiDraft = () =>
  useMutation({
    mutationFn: (input: { equipmentId: string; idea: string }) =>
      api.post<AiDraftResponse>('/ai/draft', input),
  });
