import { ConsoleShell } from "../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../console-auth";
import ManagedHomeworkClient from "./ManagedHomeworkClient";
export const dynamic = "force-dynamic";
export default async function ConsoleHomeworkPage() {
  const user = await consoleUser("/console/homework/");
  if (!user) return <ConsoleForbidden />;
  return <ConsoleShell user={user} returnTo="/console/homework/"><ManagedHomeworkClient userId={user.userId} role={user.role} /></ConsoleShell>;
}
