import css from "./styles.css"
import { WorktreePlugin } from "./plugin"

const STYLE_TAG = "data-dsh-worktree-style"
if (typeof document !== "undefined" && !document.querySelector(`style[${STYLE_TAG}]`)) {
  const style = document.createElement("style")
  style.setAttribute(STYLE_TAG, "")
  style.textContent = css
  document.head.appendChild(style)
}

export default WorktreePlugin
