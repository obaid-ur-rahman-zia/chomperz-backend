import type { IUser } from "../models/User";
import type { INft } from "../models/Nft";

const FALLBACK_AVATAR = "/images/chomper.jpg";

export function resolveDisplayAvatar(
  user: Pick<IUser, "profilePicUrl" | "avatarSource" | "avatarNftTokenId">,
  nfts: Pick<INft, "tokenId" | "imageUrl">[] = []
): string {
  if (user.avatarSource === "nft" && user.avatarNftTokenId != null) {
    const match = nfts.find((n) => n.tokenId === user.avatarNftTokenId);
    if (match?.imageUrl) return match.imageUrl;
    return FALLBACK_AVATAR;
  }
  if (user.avatarSource === "twitter" && user.profilePicUrl) {
    return user.profilePicUrl;
  }
  return FALLBACK_AVATAR;
}

export async function resolveDisplayAvatarForUser(
  user: IUser,
  nfts?: Pick<INft, "tokenId" | "imageUrl">[]
): Promise<string> {
  return resolveDisplayAvatar(user, nfts ?? []);
}
