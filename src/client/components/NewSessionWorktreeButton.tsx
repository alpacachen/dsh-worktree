import { GitTreeIcon } from "./GitTreeIcon"
import { Button } from "./ui"
import { useT } from "../lib/i18n"
import type { Workspace } from "../lib/types"

interface NewSessionWorktreeButtonProps {
  session: {
    sessionId: string
    blank: boolean
  }
  useWorkspaces: <T>(selector: (state: { items: Workspace[] }) => T) => T
  onOpen: (workspace: Workspace) => void
}

export function NewSessionWorktreeButton({ session, useWorkspaces, onOpen }: NewSessionWorktreeButtonProps) {
  const t = useT()
  const workspace = useWorkspaces((state) => state.items.find((item) => item.sessionIds?.includes(session.sessionId)))

  if (!session.blank || !workspace) return null

  return (
    <div className="dswt-new-session-action">
      <Button type="button" className="dswt-new-session-button" onClick={() => onOpen(workspace)}>
        <GitTreeIcon />
        {t("createWorktree")}
      </Button>
    </div>
  )
}
