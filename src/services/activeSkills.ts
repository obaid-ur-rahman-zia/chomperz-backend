import {
  Skill,
  type ISkill,
  type ActiveSkillType,
  ACTIVE_SKILL_TYPES,
  getSkillLevel,
  getSkillXp,
  setSkillLevel,
  addSkillXp,
  ensurePlayerSkills,
  getPlayerSkillEntry,
  syncLegacyFieldsFromPlayerSkills,
} from "../models/Skill";
import { ACTIVE_SKILL_CONFIG } from "../data/activeSkills";
import {
  actionDurationMs,
  gatherYieldPct,
  xpToNextLevel,
  GATHER_XP,
  CRAFT_XP,
  inputItemId,
  inputQuantity,
} from "../lib/formulas";
import { addItem, removeItem, getItemQuantity } from "./inventory";
import { applyPendingStatUpgrades } from "./skills";

export interface ActionStatus {
  state: "idle" | "running" | "completed";
  skill: ActiveSkillType | null;
  progressPct: number;
  secondsRemaining: number;
  startedAt: string | null;
  durationMs: number | null;
}

function skillSuccessPct(skillId: ActiveSkillType, level: number): number {
  if (skillId === "carpentry" || skillId === "smithing") return 100;
  return gatherYieldPct(skillId, level);
}

function levelUpIfReady(skill: ISkill, skillType: ActiveSkillType): void {
  let level = getSkillLevel(skill, skillType);
  let xp = getSkillXp(skill, skillType);
  let needed = xpToNextLevel(skillType, level);
  while (xp >= needed && level < 100) {
    level += 1;
    xp -= needed;
    setSkillLevel(skill, skillType, level);
    getPlayerSkillEntry(skill, skillType).xp = xp;
    syncLegacyFieldsFromPlayerSkills(skill);
    needed = xpToNextLevel(skillType, level);
  }
}

/** Run one skill cycle; returns false if craft materials are insufficient. */
async function runSingleCycle(
  skill: ISkill,
  userId: string,
  skillType: ActiveSkillType
): Promise<boolean> {
  const matId = inputItemId(skillType);
  const matQty = inputQuantity(skillType);
  const isCraft = skillType === "carpentry" || skillType === "smithing";

  if (matId && matQty > 0) {
    const have = await getItemQuantity(userId, matId);
    if (have < matQty) return false;
    await removeItem(userId, matId, matQty);
  }

  const config = ACTIVE_SKILL_CONFIG[skillType];
  const level = getSkillLevel(skill, skillType);
  const successPct = skillSuccessPct(skillType, level);
  const success = isCraft || Math.random() * 100 < successPct;

  if (success) {
    await addItem(userId, config.rewardItemId, 1);
    addSkillXp(skill, skillType, isCraft ? CRAFT_XP : GATHER_XP);
    levelUpIfReady(skill, skillType);
  }

  return true;
}

/** Max cycles simulated per request — prevents /player/me hanging after long idle sessions. */
const MAX_CATCHUP_CYCLES = 50;

/**
 * Process completed cycles since startedAt, then keep the action running
 * (continuous loop) until craft materials run out.
 */
async function ensureActionAdvanced(skill: ISkill, userId: string): Promise<number> {
  const action = skill.activeAction;
  if (!action) return 0;

  const skillType = action.skill;
  const durationMs = action.durationMs;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    skill.activeAction = null;
    syncLegacyFieldsFromPlayerSkills(skill);
    await skill.save();
    return 0;
  }

  let startMs = new Date(action.startedAt).getTime();
  const now = Date.now();
  let elapsed = now - startMs;
  let cyclesProcessed = 0;

  const backlogCycles = Math.floor(elapsed / durationMs);
  if (backlogCycles > MAX_CATCHUP_CYCLES) {
    // Long offline session — skip simulating every missed cycle (prevents /me timeouts).
    const remainder = elapsed % durationMs;
    startMs = now - remainder;
    skill.activeAction = {
      skill: skillType,
      startedAt: new Date(startMs),
      durationMs,
    };
    syncLegacyFieldsFromPlayerSkills(skill);
    await skill.save();
    return 0;
  }

  while (elapsed >= durationMs && cyclesProcessed < MAX_CATCHUP_CYCLES) {
    const ran = await runSingleCycle(skill, userId, skillType);
    if (!ran) {
      skill.activeAction = null;
      syncLegacyFieldsFromPlayerSkills(skill);
      await skill.save();
      return cyclesProcessed;
    }

    cyclesProcessed += 1;
    startMs += durationMs;
    elapsed = now - startMs;
  }

  if (elapsed >= durationMs) {
    // Skip simulating a huge offline backlog — snap to the current cycle tick.
    const remainder = elapsed % durationMs;
    startMs = now - remainder;
  }

  skill.activeAction = {
    skill: skillType,
    startedAt: new Date(startMs),
    durationMs,
  };
  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();
  return cyclesProcessed;
}

function resolveActionStatus(skill: ISkill): ActionStatus {
  const action = skill.activeAction;
  if (!action) {
    return {
      state: "idle",
      skill: skill.selectedSkill,
      progressPct: 0,
      secondsRemaining: 0,
      startedAt: null,
      durationMs: null,
    };
  }

  const elapsed = Date.now() - new Date(action.startedAt).getTime();
  const remaining = Math.max(0, action.durationMs - elapsed);
  const progressPct = Math.min(100, Math.round((elapsed / action.durationMs) * 100));

  return {
    state: "running",
    skill: action.skill,
    progressPct,
    secondsRemaining: Math.ceil(remaining / 1000),
    startedAt: new Date(action.startedAt).toISOString(),
    durationMs: action.durationMs,
  };
}

function serializePlayerSkills(skill: ISkill) {
  ensurePlayerSkills(skill);
  return skill.playerSkills.map((entry) => ({
    skillName: entry.skillName,
    level: entry.level,
    xp: entry.xp,
    active: entry.active,
    actionDurationMs: actionDurationMs(entry.skillName),
    successPct:
      entry.skillName === "carpentry" || entry.skillName === "smithing"
        ? 100
        : Math.round(gatherYieldPct(entry.skillName, entry.level) * 10) / 10,
  }));
}

export function serializeSkillsState(skill: ISkill, inventoryQty = 0, inputQty = 0) {
  ensurePlayerSkills(skill);
  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const level = getSkillLevel(skill, selected);
  const xp = getSkillXp(skill, selected);
  const successPct = skillSuccessPct(selected, level);
  const durationMs = actionDurationMs(selected);

  return {
    selectedSkill: selected,
    playerSkills: serializePlayerSkills(skill),
    skills: ACTIVE_SKILL_TYPES.map((id) => {
      const cfg = ACTIVE_SKILL_CONFIG[id];
      const lvl = getSkillLevel(skill, id);
      const skillXp = getSkillXp(skill, id);
      const pct = skillSuccessPct(id, lvl);
      return {
        id,
        label: cfg.label,
        level: lvl,
        xp: skillXp,
        xpToNext: xpToNextLevel(id, lvl),
        rewardItemId: cfg.rewardItemId,
        rewardItemLabel: cfg.rewardItemLabel,
        successPct: Math.round(pct * 10) / 10,
        failPct: Math.round((100 - pct) * 10) / 10,
        inputItemId: inputItemId(id),
        inputQuantity: inputQuantity(id),
        actionDurationMs: actionDurationMs(id),
      };
    }),
    selected: {
      ...config,
      level,
      xp,
      xpToNext: xpToNextLevel(selected, level),
      inventoryQty,
      inputQty,
      successPct: Math.round(successPct * 10) / 10,
      failPct: Math.round((100 - successPct) * 10) / 10,
      inputItemId: inputItemId(selected),
      inputQuantity: inputQuantity(selected),
      actionDurationMs: durationMs,
      actionDurationSec: durationMs / 1000,
    },
    action: resolveActionStatus(skill),
  };
}

async function loadSkillDocument(userId: string): Promise<ISkill> {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");
  await applyPendingStatUpgrades(skill);
  ensurePlayerSkills(skill);
  return skill;
}

export async function getSkillsPayload(
  userId: string,
  options?: { catchUp?: boolean; skill?: ISkill }
) {
  const skill =
    options?.skill ??
    (await Skill.findOne({ userId }));
  if (!skill) throw new Error("Skill not found");

  if (!options?.skill) {
    await applyPendingStatUpgrades(skill);
    ensurePlayerSkills(skill);
  }

  if (options?.catchUp === false) {
    return buildSkillsPayload(skill, userId);
  }

  await ensureActionAdvanced(skill, userId);

  const refreshed = await Skill.findOne({ userId });
  if (!refreshed) throw new Error("Skill not found");

  return buildSkillsPayload(refreshed, userId);
}

async function buildSkillsPayload(skill: ISkill, userId: string) {
  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const inventoryQty = await getItemQuantity(userId, config.rewardItemId);
  const inputId = inputItemId(selected);
  const inputQty = inputId ? await getItemQuantity(userId, inputId) : 0;

  return serializeSkillsState(skill, inventoryQty, inputQty);
}

export async function selectSkill(userId: string, skillType: ActiveSkillType) {
  const skill = await loadSkillDocument(userId);

  if (skill.activeAction) {
    await ensureActionAdvanced(skill, userId);
    const updated = await Skill.findOne({ userId });
    if (updated?.activeAction) {
      updated.activeAction = null;
      await updated.save();
    }
  }

  const fresh = await Skill.findOne({ userId });
  if (!fresh) throw new Error("Skill not found");

  fresh.selectedSkill = skillType;
  ensurePlayerSkills(fresh);
  for (const entry of fresh.playerSkills) {
    entry.active = entry.skillName === skillType;
  }
  syncLegacyFieldsFromPlayerSkills(fresh);
  await fresh.save();
  return getSkillsPayload(userId);
}

export async function startAction(userId: string) {
  const skill = await loadSkillDocument(userId);

  if (skill.activeAction) {
    throw new Error("An action is already running");
  }

  const selected = skill.selectedSkill ?? "woodcutting";
  const matId = inputItemId(selected);
  const matQty = inputQuantity(selected);

  if (matId && matQty > 0) {
    const have = await getItemQuantity(userId, matId);
    if (have < matQty) {
      throw new Error(`Need ${matQty} ${matId} to start`);
    }
  }

  const durationMs = actionDurationMs(selected);

  skill.activeAction = {
    skill: selected,
    startedAt: new Date(),
    durationMs,
  };
  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();

  return getSkillsPayload(userId);
}

export async function completeAction(userId: string) {
  const skill = await loadSkillDocument(userId);

  if (!skill.activeAction) {
    throw new Error("No active action");
  }

  const cycles = await ensureActionAdvanced(skill, userId);
  const payload = await getSkillsPayload(userId);

  return {
    ...payload,
    result: {
      success: cycles > 0,
      cyclesProcessed: cycles,
    },
  };
}

export async function stopAction(userId: string) {
  const skill = await loadSkillDocument(userId);

  if (!skill.activeAction) {
    throw new Error("No active action to stop");
  }

  skill.activeAction = null;
  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();

  return getSkillsPayload(userId);
}

export async function getActionStatus(userId: string) {
  const skill = await loadSkillDocument(userId);
  await ensureActionAdvanced(skill, userId);

  const refreshed = await Skill.findOne({ userId });
  if (!refreshed) throw new Error("Skill not found");

  return resolveActionStatus(refreshed);
}
