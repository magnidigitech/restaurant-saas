import ModuleDetailPage, {
  generateMetadata as generateModuleMetadata,
} from "@/app/modules/[slug]/page";
import { RESTO_BIRD_MODULES } from "@/lib/modulesData";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return Object.keys(RESTO_BIRD_MODULES).map((slug) => ({
    slug,
  }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  return generateModuleMetadata(props);
}

export default async function Page(props: PageProps) {
  return <ModuleDetailPage {...props} />;
}
