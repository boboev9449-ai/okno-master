import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/components/okno/orders";

export const Route = createFileRoute("/orders/")({ component: OrdersPage });
