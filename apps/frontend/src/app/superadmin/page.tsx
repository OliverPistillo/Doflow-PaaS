// apps/frontend/src/app/superadmin/page.tsx
import { redirect } from "next/navigation";

export default function SuperadminIndexPage() {
  redirect("/superadmin/dashboard");
}
