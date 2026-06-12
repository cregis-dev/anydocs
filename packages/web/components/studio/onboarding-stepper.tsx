'use client';

import { useState, type ReactNode } from 'react';
import { Check, Cpu, FolderGit2, PartyPopper, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * OnboardingStepper (Story 13.5) — a four-step first-launch flow
 * (Welcome → Vault → Model → Done) matching the Claude Design onboarding screens.
 *
 * TEST-SAFE SLICE: this stepper precedes the existing `welcome-screen.tsx`, which
 * keeps the actual project/vault selection responsibility (AC3). The Model step's
 * selection is persisted LOCALLY (localStorage) as a placeholder — the real
 * provider-port persistence is Story 11.1 (Epic 11), not yet built. No API key is
 * stored (secrets stay out of localStorage); BYOK key entry is deferred to the
 * provider-port. On Done the host marks onboarding complete and shows the
 * welcome-screen / Library.
 */

const MODEL_PREF_STORAGE_KEY = 'anydocs.onboarding.modelPreference';

const STEPS = ['Welcome', 'Vault', 'Model', 'Done'] as const;
type StepIndex = 0 | 1 | 2 | 3;

const LOCAL_PROVIDERS = ['ollama', 'llama.cpp', 'mlx'] as const;
const CLOUD_PROVIDERS = ['openai', 'anthropic'] as const;

export type ModelPreference = { provider: string; model: string };

export type OnboardingStepperProps = {
  /** Called when the user finishes (Done → Open Studio). The host persists the completion flag + shows welcome/Library. */
  onComplete: (preference: ModelPreference) => void;
  /** Optional: skip onboarding entirely (e.g. a "Skip setup" affordance). */
  onSkip?: () => void;
};

function persistModelPreference(preference: ModelPreference): void {
  try {
    window.localStorage.setItem(MODEL_PREF_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // localStorage unavailable (private mode / SSR) — non-fatal; the host still proceeds.
  }
}

function StepDots({ active }: { active: StepIndex }) {
  return (
    <div className="mb-8 flex items-center gap-2" data-testid="onboarding-progress">
      {STEPS.map((label, index) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={cn(
              'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
              index < active && 'bg-fd-primary text-fd-primary-foreground',
              index === active && 'bg-fd-primary text-fd-primary-foreground ring-2 ring-fd-ring ring-offset-2 ring-offset-fd-background',
              index > active && 'bg-fd-muted text-fd-muted-foreground',
            )}
          >
            {index < active ? <Check className="size-3.5" /> : index + 1}
          </div>
          {index < STEPS.length - 1 ? (
            <div className={cn('h-px w-8', index < active ? 'bg-fd-primary' : 'bg-fd-border')} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function OnboardingStepper({ onComplete, onSkip }: OnboardingStepperProps) {
  const [step, setStep] = useState<StepIndex>(0);
  const [provider, setProvider] = useState<string>('ollama');
  const [model, setModel] = useState<string>('llama-3.1-8b');

  const isCloud = CLOUD_PROVIDERS.includes(provider as (typeof CLOUD_PROVIDERS)[number]);

  function next() {
    setStep((current) => Math.min(current + 1, 3) as StepIndex);
  }
  function back() {
    setStep((current) => Math.max(current - 1, 0) as StepIndex);
  }
  function finish() {
    const preference: ModelPreference = { provider, model };
    persistModelPreference(preference);
    onComplete(preference);
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-fd-background p-6" data-testid="studio-onboarding">
      <div className="w-full max-w-xl rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm">
        <StepDots active={step} />

        {step === 0 ? (
          <div data-testid="onboarding-step-welcome">
            <Sparkles className="mb-3 size-7 text-fd-primary" />
            <h1 className="mb-2 text-2xl font-semibold">Welcome to Anydocs</h1>
            <p className="mb-8 text-sm text-fd-muted-foreground">
              A local-first, AI-era documentation editor. Let&apos;s set up your vault and model preference — it only takes a moment.
            </p>
            <div className="flex justify-between">
              {onSkip ? (
                <button type="button" onClick={onSkip} className="text-sm text-fd-muted-foreground hover:text-fd-foreground" data-testid="onboarding-skip">
                  Skip setup
                </button>
              ) : <span />}
              <PrimaryButton onClick={next}>Get started</PrimaryButton>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div data-testid="onboarding-step-vault">
            <FolderGit2 className="mb-3 size-7 text-fd-primary" />
            <h1 className="mb-2 text-2xl font-semibold">Your vault</h1>
            <p className="mb-2 text-sm text-fd-muted-foreground">
              A vault is a project folder of documentation pages on disk. On the next screen you can open an existing vault or create a new one.
            </p>
            <p className="mb-8 rounded-lg border border-fd-border bg-fd-background p-3 text-xs text-fd-muted-foreground">
              Pages live under <code className="font-mono">pages/&lt;lang&gt;/</code>; navigation and config sit alongside. Nothing leaves your machine.
            </p>
            <StepNav onBack={back} onNext={next} />
          </div>
        ) : null}

        {step === 2 ? (
          <div data-testid="onboarding-step-model">
            <Cpu className="mb-3 size-7 text-fd-primary" />
            <h1 className="mb-2 text-2xl font-semibold">Choose your model</h1>
            <p className="mb-5 text-sm text-fd-muted-foreground">
              Anydocs defaults to a local model. You can switch to a cloud provider (bring your own key) later.
            </p>
            <label className="mb-1 block text-xs font-semibold text-fd-muted-foreground">Provider</label>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mb-4 w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-sm"
              data-testid="onboarding-provider"
            >
              <optgroup label="Local">
                {LOCAL_PROVIDERS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </optgroup>
              <optgroup label="Cloud (BYOK)">
                {CLOUD_PROVIDERS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </optgroup>
            </select>
            <label className="mb-1 block text-xs font-semibold text-fd-muted-foreground">Model</label>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-sm font-mono"
              data-testid="onboarding-model"
            />
            {isCloud ? (
              <p className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 text-xs text-fd-muted-foreground dark:bg-amber-950/20">
                Cloud providers need an API key. Key entry + provider wiring arrive with the built-in Agent (Epic 11); for now your provider/model choice is saved locally.
              </p>
            ) : null}
            <div className="mt-8">
              <StepNav onBack={back} onNext={next} nextLabel="Continue" />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div data-testid="onboarding-step-done">
            <PartyPopper className="mb-3 size-7 text-fd-primary" />
            <h1 className="mb-2 text-2xl font-semibold">You&apos;re all set</h1>
            <p className="mb-5 text-sm text-fd-muted-foreground">
              Model preference saved: <span className="font-mono">{provider} · {model}</span>. Open your vault to start writing.
            </p>
            <div className="flex justify-between">
              <SecondaryButton onClick={back}>Back</SecondaryButton>
              <PrimaryButton onClick={finish}>Open Studio</PrimaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepNav({ onBack, onNext, nextLabel = 'Next' }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex justify-between">
      <SecondaryButton onClick={onBack}>Back</SecondaryButton>
      <PrimaryButton onClick={onNext}>{nextLabel}</PrimaryButton>
    </div>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition hover:opacity-90"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-fd-border px-4 py-2 text-sm font-medium text-fd-foreground transition hover:bg-fd-muted"
    >
      {children}
    </button>
  );
}

export const ONBOARDING_MODEL_PREF_STORAGE_KEY = MODEL_PREF_STORAGE_KEY;
