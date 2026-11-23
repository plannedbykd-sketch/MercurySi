import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppTabKey =
  | 'overview'
  | 'chat'
  | 'secrets'
  | 'visualizations'
  | 'hybrid'
  | 'par'
  | 'ledger'
  | 'honesty';

export interface EnvPipelineLink {
  id: string;
  label: string;
  tab: AppTabKey;
  providerId?: string;
}

export interface EnvSecretDescriptor {
  envVar: string;
  label: string;
  category: 'Required Core' | 'Optional BYOK' | 'Local Runtime' | 'Runtime Host';
  required: boolean;
  configured: boolean;
  description: string;
  whereToSet: string;
  exampleLine: string;
  pipelines: EnvPipelineLink[];
}

export interface MissingSecretAlert {
  id: string;
  envVar: string;
  severity: 'error' | 'warning';
  sourceLabel: string;
  message: string;
  returnTab: AppTabKey;
  returnProviderId?: string;
}

interface SecretsAlertContextValue {
  envItems: EnvSecretDescriptor[];
  envLoading: boolean;
  lastCheckedAt: string | null;
  missingRequiredCount: number;
  missingTotalCount: number;
  activeAlert: MissingSecretAlert | null;
  highlightedEnvVar: string | null;
  pendingChatProviderId: string | null;
  returnPipeline: { tab: AppTabKey; providerId?: string; label: string } | null;
  refreshEnvStatus: () => Promise<void>;
  triggerMissingSecretAlert: (opts: {
    envVar: string;
    sourceLabel: string;
    message?: string;
    severity?: 'error' | 'warning';
    returnTab: AppTabKey;
    returnProviderId?: string;
  }) => void;
  dismissAlert: () => void;
  clearHighlight: () => void;
  consumePendingChatProvider: () => void;
  redirectToSecret: (
    envVar: string,
    onNavigateTab: (tab: AppTabKey) => void,
    returnPipeline?: { tab: AppTabKey; providerId?: string; label: string }
  ) => void;
  launchPipelineFromSecret: (
    link: EnvPipelineLink,
    onNavigateTab: (tab: AppTabKey) => void
  ) => void;
}

const SecretsAlertContext = createContext<SecretsAlertContextValue | null>(null);

export function SecretsAlertProvider({ children }: { children: ReactNode }) {
  const [envItems, setEnvItems] = useState<EnvSecretDescriptor[]>([]);
  const [envLoading, setEnvLoading] = useState<boolean>(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<MissingSecretAlert | null>(null);
  const [highlightedEnvVar, setHighlightedEnvVar] = useState<string | null>(null);
  const [pendingChatProviderId, setPendingChatProviderId] = useState<string | null>(null);
  const [returnPipeline, setReturnPipeline] = useState<{
    tab: AppTabKey;
    providerId?: string;
    label: string;
  } | null>(null);

  const refreshEnvStatus = useCallback(async () => {
    setEnvLoading(true);
    try {
      const res = await fetch('/api/env/status');
      if (!res.ok) return;
      const data = (await res.json()) as {
        checkedAt?: string;
        items?: EnvSecretDescriptor[];
      };
      if (Array.isArray(data.items)) {
        setEnvItems(data.items);
        setLastCheckedAt(data.checkedAt ?? new Date().toISOString());

        // Auto-clear an active alert if its envVar is now configured on the server
        setActiveAlert((prev) => {
          if (!prev) {
            const missingRequired = data.items?.find((item) => item.required && !item.configured);
            if (missingRequired) {
              return {
                id: `req-${missingRequired.envVar}`,
                envVar: missingRequired.envVar,
                severity: 'error',
                sourceLabel: 'Core Server Pipeline',
                message: `${missingRequired.envVar} is not configured on the server. Core AI Chat and Search Grounding pipelines require it in Settings > Secrets.`,
                returnTab: 'overview',
              };
            }
            return null;
          }
          const matched = data.items?.find((item) => item.envVar === prev.envVar);
          if (matched?.configured) {
            return null;
          }
          return prev;
        });
      }
    } catch {
      // Ignore transient network failures
    } finally {
      setEnvLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshEnvStatus();
  }, [refreshEnvStatus]);

  const missingRequiredCount = useMemo(
    () => envItems.filter((item) => item.required && !item.configured).length,
    [envItems]
  );

  const missingTotalCount = useMemo(
    () => envItems.filter((item) => !item.configured).length,
    [envItems]
  );

  const triggerMissingSecretAlert = useCallback(
    (opts: {
      envVar: string;
      sourceLabel: string;
      message?: string;
      severity?: 'error' | 'warning';
      returnTab: AppTabKey;
      returnProviderId?: string;
    }) => {
      setActiveAlert({
        id: `${opts.envVar}-${Date.now()}`,
        envVar: opts.envVar,
        severity: opts.severity ?? 'warning',
        sourceLabel: opts.sourceLabel,
        message:
          opts.message ||
          `${opts.envVar} is missing on the server for ${opts.sourceLabel}. Redirect to Secrets & Env Keys to inspect configuration instructions.`,
        returnTab: opts.returnTab,
        returnProviderId: opts.returnProviderId,
      });
    },
    []
  );

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedEnvVar(null);
  }, []);

  const consumePendingChatProvider = useCallback(() => {
    setPendingChatProviderId(null);
  }, []);

  const redirectToSecret = useCallback(
    (
      envVar: string,
      onNavigateTab: (tab: AppTabKey) => void,
      nextReturnPipeline?: { tab: AppTabKey; providerId?: string; label: string }
    ) => {
      setHighlightedEnvVar(envVar);
      if (nextReturnPipeline) {
        setReturnPipeline(nextReturnPipeline);
      }
      onNavigateTab('secrets');
    },
    []
  );

  const launchPipelineFromSecret = useCallback(
    (link: EnvPipelineLink, onNavigateTab: (tab: AppTabKey) => void) => {
      if (link.tab === 'chat' && link.providerId) {
        setPendingChatProviderId(link.providerId);
      }
      setReturnPipeline(null);
      onNavigateTab(link.tab);
    },
    []
  );

  return (
    <SecretsAlertContext.Provider
      value={{
        envItems,
        envLoading,
        lastCheckedAt,
        missingRequiredCount,
        missingTotalCount,
        activeAlert,
        highlightedEnvVar,
        pendingChatProviderId,
        returnPipeline,
        refreshEnvStatus,
        triggerMissingSecretAlert,
        dismissAlert,
        clearHighlight,
        consumePendingChatProvider,
        redirectToSecret,
        launchPipelineFromSecret,
      }}
    >
      {children}
    </SecretsAlertContext.Provider>
  );
}

export function useSecretsAlert(): SecretsAlertContextValue {
  const ctx = useContext(SecretsAlertContext);
  if (!ctx) {
    throw new Error('useSecretsAlert must be used inside SecretsAlertProvider');
  }
  return ctx;
}
