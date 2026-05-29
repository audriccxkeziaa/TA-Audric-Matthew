// Badge tingkat urgensi restock: HABIS / KRITIS / MENIPIS.

import { Badge } from "@/components/ui";

export function UrgensiBadge({ level }) {
  if (level === "HABIS") return <Badge tone="red">HABIS</Badge>;
  if (level === "KRITIS") return <Badge tone="amber">KRITIS</Badge>;
  return <Badge tone="blue">MENIPIS</Badge>;
}
