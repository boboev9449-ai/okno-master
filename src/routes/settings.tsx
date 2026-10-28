import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/okno/settings";

export const Route = createFileRoute("/settings")({ component: SettingsPage });
