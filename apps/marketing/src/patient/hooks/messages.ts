"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { Conversation, Message } from "@/patient/types/patient";

export function useConversations() {
  return useQuery<{ conversations: Conversation[] }>({
    queryKey: patientKeys.conversations(),
    queryFn: () =>
      api<{ conversations: Conversation[] }>(patientPaths.messages.conversations()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useConversationMessages(conversationId: string) {
  return useQuery<{
    conversation: Conversation;
    doctor: { id: string; userId: string; name: string; photo: string | null } | null;
    messages: Message[];
  }>({
    queryKey: patientKeys.conversation(conversationId),
    queryFn: () =>
      api<{
        conversation: Conversation;
        doctor: { id: string; userId: string; name: string; photo: string | null } | null;
        messages: Message[];
      }>(patientPaths.messages.conversationMessages(conversationId)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(conversationId),
  });
}

export function useSendPatientMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<{ message: Message }>(
        patientPaths.messages.conversationMessages(conversationId),
        { method: "POST", json: { body } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: patientKeys.conversations() });
    },
  });
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(patientPaths.messages.conversationRead(conversationId), {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: patientKeys.conversations() });
    },
  });
}
