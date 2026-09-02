import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { pb } from "@/lib/pocketbase";

export const Route = createFileRoute("/_authed")({
  ssr: false,
  beforeLoad: async () => {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      throw redirect({ to: "/login" });
    }
    try {
      await pb.collection("agency_client_users").authRefresh();
    } catch {
      pb.authStore.clear();
      throw redirect({ to: "/login" });
    }
    const record = pb.authStore.record;
    return {
      userId: record.id,
      agencyClientId: record["agency_client_id"] as string,
    };
  },
  component: () => <Outlet />,
});
