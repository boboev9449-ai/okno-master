import { createFileRoute } from "@tanstack/react-router";
import { ObjectEditor } from "@/components/okno/objects";

export const Route = createFileRoute("/objects/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    customerId: typeof search.customerId === "string" ? search.customerId : undefined,
  }),
  component: function ObjectRoute() {
    const { id } = Route.useParams();
    const { customerId } = Route.useSearch();
    return <ObjectEditor objectId={id} customerId={customerId} />;
  },
});
