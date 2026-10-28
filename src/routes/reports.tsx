import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/okno/reports";

export const Route = createFileRoute("/reports")({ component: ReportsPage });
