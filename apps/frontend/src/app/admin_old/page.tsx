// apps/frontend/src/app/admin/page.tsx
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/users");
}
