/** Lab order list filters — shared by global and per-patient pages. */

export type LabOrderStatusFilter =
  | "all"
  | "ordered"
  | "processing"
  | "completed"
  | "cancelled";

export const LAB_ORDER_STATUS_FILTERS: LabOrderStatusFilter[] = [
  "all",
  "ordered",
  "processing",
  "completed",
  "cancelled",
];

/** i18n key under `tab.labs.*` for filter pill labels. */
export function labOrderFilterLabelKey(filter: LabOrderStatusFilter): string {
  if (filter === "all") return "tab.labs.filterAll";
  const tail = filter[0].toUpperCase() + filter.slice(1);
  return `tab.labs.filter${tail}`;
}

/** Map UI filter → `status` query param (comma-separated when needed). */
export function labOrderFilterToQuery(
  filter: LabOrderStatusFilter,
): string | undefined {
  if (filter === "all") return undefined;
  if (filter === "processing") return "sample_collected,in_progress";
  return filter;
}

export function labOrderStatusLabelKey(status: string): string {
  return `status.${status}`;
}

export function labOrderPriorityLabelKey(priority: string): string {
  return `priority.${priority}`;
}
