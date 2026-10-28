import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/okno/home";

export const Route = createFileRoute("/")({ component: HomePage });
