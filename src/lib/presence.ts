import type { Claw, TeamState } from "../domain/types.ts";

export function presenceLine(team: TeamState, claws: readonly Claw[]): string[] {
  return team.members.map((member) => {
    const claw = claws.find((item) => item.id === member.viewingClawId);
    const where = claw ? `正在看 ${claw.name}` : "在线";
    return `${member.name} · ${member.role === "owner" ? "主人" : "客人"} · ${where}`;
  });
}
