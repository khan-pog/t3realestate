import { Dialog } from "~/components/ui/dialog";
import FullPagePropertyView from "~/components/property/full-page-property-view";

interface PageProps {
  params: {
    id: string;
  };
}

export default function PropertyModalPage({ params }: PageProps) {
  return (
    <Dialog>
      <FullPagePropertyView id={params.id} />
    </Dialog>
  );
} 