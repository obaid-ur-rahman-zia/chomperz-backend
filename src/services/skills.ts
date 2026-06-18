import { Skill, type ISkill } from "../models/Skill";
import { getUpgradeCost } from "../lib/economy";
import { debitBalance } from "./resources";

export async function getSkill(userId: string): Promise<ISkill | null> {
  return Skill.findOne({ userId });
}

export async function ensureSkill(userId: string): Promise<ISkill> {
  let skill = await Skill.findOne({ userId });
  if (!skill) {
    skill = await Skill.create({ userId });
  }
  return skill;
}

export async function upgradeSkill(
  userId: string,
  stat: "power" | "speed"
): Promise<{ skill: ISkill; zCoins: number }> {
  const skill = await ensureSkill(userId);
  const level = stat === "power" ? skill.powerLvl : skill.speedLvl;
  if (level >= 100) {
    throw new Error("Max level reached");
  }

  const cost = getUpgradeCost(level);
  const zCoins = await debitBalance(userId, "zCoins", cost, "upgrade", { stat, fromLevel: level });

  if (stat === "power") skill.powerLvl += 1;
  else skill.speedLvl += 1;
  await skill.save();

  return { skill, zCoins };
}

export function getUpgradeCosts(skill: ISkill) {
  return {
    powerUpgradeCost: getUpgradeCost(skill.powerLvl),
    speedUpgradeCost: getUpgradeCost(skill.speedLvl),
  };
}
