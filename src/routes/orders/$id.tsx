import { createFileRoute } from "@tanstack/react-router";
import { OrderEditor } from "@/components/okno/orders";

export const Route = createFileRoute("/orders/$id")({
  component: function OrderRoute() {
    const { id } = Route.useParams();
    return <OrderEditor orderId={id} />;
  },
});
