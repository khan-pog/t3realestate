import FullPagePropertyView from "~/components/property/full-page-property-view";

interface PageProps {
  params: {
    id: string;
  };
}

export default function PropertyPage({ params }: PageProps) {
  console.log('Property page params:', params);
  return <FullPagePropertyView id={params.id} />;
} 