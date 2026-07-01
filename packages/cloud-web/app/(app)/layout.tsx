// Placeholder for the four-region app shell (Workspace Rail / Navigation / Canvas / Agent panel).
// The real shell is built in Story C1.4; this just establishes the (app) route group.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div data-region="app-shell">{children}</div>;
}
