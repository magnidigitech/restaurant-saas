import { redirect } from "next/navigation";

export default async function RestaurantSettingsRootPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  redirect(`/restaurant/${subdomain}/settings/profile`);
}
