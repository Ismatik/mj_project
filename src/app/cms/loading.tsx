import { PageSkeleton } from "@/components/fx/Skeleton";

// Shimmer placeholder while a CMS section loads (the prototype's page-switch skeleton).
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Загрузка" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageSkeleton />
    </div>
  );
}
