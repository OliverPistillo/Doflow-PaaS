import { redirect } from "next/navigation";
import { cookies } from "next/headers";

function parseJwt(token: string): any {
  try {
    const payload = token.split(".")[1];
    const decoded = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default function BusinaroRoot() {
  const token = cookies().get("token")?.value; // adegua al tuo cookie reale
  if (!token) redirect("/login");

  const jwt = parseJwt(token);
  const role = jwt?.role;

  if (role === "MACHINE_TOOLS") redirect("/businaro/macchine-utensili");
  if (role === "WAREHOUSE") redirect("/businaro/magazzino");
  if (role === "ASSEMBLY") redirect("/businaro/assemblaggio");
  redirect("/businaro/dashboard");
}
