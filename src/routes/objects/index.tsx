import { createFileRoute } from "@tanstack/react-router";
import { ObjectsPage } from "@/components/okno/objects";

export const Route = createFileRoute("/objects/")({ component: ObjectsPage });
