import { Skill, type ISkill, ensurePlayerSkills, syncLegacyFieldsFromPlayerSkills } from "../models/Skill";
import { getUpgradeCost } from "../lib/economy";
import { getUpgradeTimerMs } from "../lib/formulas";
import { debitBalance } from "./resources";

export async function getSkill(userId: string): Promise<ISkill | null> {
  return Skill.findOne({ userId });
}

export async function ensureSkill(userId: string): Promise<ISkill> {
  let skill = await Skill.findOne({ userId });
  if (!skill) {
    skill = await Skill.create({ userId, selectedSkill: "woodcutting" });
  }
  if (!skill.selectedSkill) {
    skill.selectedSkill = "woodcutting";
  }
  ensurePlayerSkills(skill);
  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();
  return skill;
}

function applyCompletedUpgrade(skill: ISkill, stat: "power" | "speed"): void {
  if (stat === "power" && skill.powerLvl < 100) {
    skill.powerLvl += 1;
    skill.powerUpgradingUntil = null;
  } else if (stat === "speed" && skill.speedLvl < 100) {
    skill.speedLvl += 1;
    skill.speedUpgradingUntil = null;
  }
}

export async function applyPendingStatUpgrades(skill: ISkill): Promise<void> {
  const now = new Date();
  let changed = false;

  if (skill.powerUpgradingUntil && now >= skill.powerUpgradingUntil) {
    applyCompletedUpgrade(skill, "power");
    changed = true;
  }
  if (skill.speedUpgradingUntil && now >= skill.speedUpgradingUntil) {
    applyCompletedUpgrade(skill, "speed");
    changed = true;
  }

  if (changed) await skill.save();
}

/** @deprecated use applyPendingStatUpgrades */
export async function applySpeedUpgradeIfReady(skill: ISkill): Promise<void> {
  return applyPendingStatUpgrades(skill);
}

function getUpgradeRemainingMs(until: Date | null): number {
  if (!until) return 0;
  return Math.max(0, until.getTime() - Date.now());
}

export function getSpeedUpgradeRemainingMs(skill: ISkill): number {
  return getUpgradeRemainingMs(skill.speedUpgradingUntil);
}

export function getPowerUpgradeRemainingMs(skill: ISkill): number {
  return getUpgradeRemainingMs(skill.powerUpgradingUntil);
}

export function isSpeedUpgrading(skill: ISkill): boolean {
  return getSpeedUpgradeRemainingMs(skill) > 0;
}

export function isPowerUpgrading(skill: ISkill): boolean {
  return getPowerUpgradeRemainingMs(skill) > 0;
}

export async function upgradeSkill(
  userId: string,
  stat: "power" | "speed"
): Promise<{ skill: ISkill; zCoins: number }> {
  const skill = await ensureSkill(userId);
  await applyPendingStatUpgrades(skill);

  const level = stat === "power" ? skill.powerLvl : skill.speedLvl;
  if (level >= 100) {
    throw new Error("Max level reached");
  }

  if (stat === "power" && isPowerUpgrading(skill)) {
    throw new Error("Power upgrade already in progress");
  }
  if (stat === "speed" && isSpeedUpgrading(skill)) {
    throw new Error("Speed upgrade already in progress");
  }

  const cost = getUpgradeCost(level);
  const zCoins = await debitBalance(userId, "zCoins", cost, "upgrade", { stat, fromLevel: level });

  const timerMs = getUpgradeTimerMs(level);
  const until = new Date(Date.now() + timerMs);

  if (stat === "power") {
    skill.powerUpgradingUntil = until;
  } else {
    skill.speedUpgradingUntil = until;
  }

  await skill.save();
  return { skill, zCoins };
}

export function getUpgradeCosts(skill: ISkill) {
  return {
    powerUpgradeCost: getUpgradeCost(skill.powerLvl),
    speedUpgradeCost: getUpgradeCost(skill.speedLvl),
  };
}
