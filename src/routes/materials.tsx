import { createFileRoute } from "@tanstack/react-router";
import { MaterialsPage } from "@/components/okno/materials";

export const Route = createFileRoute("/materials")({ component: MaterialsPage });
