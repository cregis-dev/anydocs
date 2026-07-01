import { create } from 'zustand';

// Local UI state only (panel collapse, command palette, run inspector). Per the architecture,
// Yjs awareness is the source of truth for collaboration; Zustand holds non-collab UI state.
interface UiState {
  navCollapsed: boolean;
  agentPanelCollapsed: boolean;
  commandPaletteOpen: boolean;
  setNavCollapsed: (v: boolean) => void;
  setAgentPanelCollapsed: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  navCollapsed: false,
  agentPanelCollapsed: false,
  commandPaletteOpen: false,
  setNavCollapsed: (v) => set({ navCollapsed: v }),
  setAgentPanelCollapsed: (v) => set({ agentPanelCollapsed: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
}));
