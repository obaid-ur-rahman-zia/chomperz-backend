import { Skill, type ISkill } from "../models/Skill";
import { getUpgradeCost } from "../lib/economy";
import { debitBalance } from "./resources";
import { SPEED_UPGRADE_DURATION_MS } from "../data/activeSkills";

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
    await skill.save();
  }
  return skill;
}

export async function applySpeedUpgradeIfReady(skill: ISkill): Promise<void> {
  if (skill.speedUpgradingUntil && new Date() >= skill.speedUpgradingUntil) {
    if (skill.speedLvl < 100) {
      skill.speedLvl += 1;
    }
    skill.speedUpgradingUntil = null;
    await skill.save();
  }
}

export function getSpeedUpgradeRemainingMs(skill: ISkill): number {
  if (!skill.speedUpgradingUntil) return 0;
  return Math.max(0, skill.speedUpgradingUntil.getTime() - Date.now());
}

export function isSpeedUpgrading(skill: ISkill): boolean {
  return getSpeedUpgradeRemainingMs(skill) > 0;
}

export async function upgradeSkill(
  userId: string,
  stat: "power" | "speed"
): Promise<{ skill: ISkill; zCoins: number }> {
  const skill = await ensureSkill(userId);
  await applySpeedUpgradeIfReady(skill);

  const level = stat === "power" ? skill.powerLvl : skill.speedLvl;
  if (level >= 100) {
    throw new Error("Max level reached");
  }

  if (stat === "speed" && isSpeedUpgrading(skill)) {
    throw new Error("Speed upgrade already in progress");
  }

  const cost = getUpgradeCost(level);
  const zCoins = await debitBalance(userId, "zCoins", cost, "upgrade", { stat, fromLevel: level });

  if (stat === "power") {
    skill.powerLvl += 1;
  } else {
    skill.speedUpgradingUntil = new Date(Date.now() + SPEED_UPGRADE_DURATION_MS);
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
