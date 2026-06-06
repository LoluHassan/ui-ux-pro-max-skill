# The differences between data, scripts and templates

## What are the three locations?

| Location | Purpose | Can it be deleted? |
|------|------|--------|
| **src/ui-ux-pro-max/** | **Only source code**. All CSV, scripts, and templates are modified here, serving as the "single source of truth". | ❌ Cannot be deleted; this is the one you need to maintain. |
| **.claude/skills/ui-ux-pro-max/** | Skill for **Cursor / Claude Code**. The AI reads SKILL.md and runs `scripts/search.js` from here. By design, data and scripts here should be **symbolic links** pointing to src, eliminating the need to maintain two copies. | ❌ Cannot be deleted (otherwise the Skill won't work); however, you can change it to only link to src without keeping a duplicate copy. |
| **cli/assets/** | Used for **npm package uipro-cli**. When a user executes `npm i -g uipro-cli` and then `uipro init`, the data/scripts/templates packed here are installed. | ❌ Cannot be deleted; just use a script to sync from src before publishing. |

## Can I only keep one?

- **No**, you cannot keep only one "physical directory": the three locations have **different purposes** and must all exist.
- **Yes**, you can maintain **only one set of content**:
  - All modifications are made only in **src/ui-ux-pro-max/**.
  - Use **symbolic links** in .claude to point to src → no need to maintain data/scripts separately in .claude.
  - Run a sync before publishing the CLI: copy src to cli/assets.

This way, you only modify src in daily work, and the other two locations follow automatically or as needed.

## Recommended Workflow

1. Only modify **src/ui-ux-pro-max/data/**, **scripts/**, **templates/**.
2. Use symlinks in .claude/skills to point back to src (see "Restore Symbolic Links" below).
3. Execute before publishing the npm package:
   ```bash
   cp -r src/ui-ux-pro-max/data/* cli/assets/data/
   cp -r src/ui-ux-pro-max/scripts/* cli/assets/scripts/
   cp -r src/ui-ux-pro-max/templates/* cli/assets/templates/
   ```
