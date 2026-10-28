import { createFileRoute } from "@tanstack/react-router";
import { CustomerEditor } from "@/components/okno/customers";

export const Route = createFileRoute("/customers/$id")({
  component: function CustomerRoute() {
    const { id } = Route.useParams();
    return <CustomerEditor customerId={id} />;
  },
});
