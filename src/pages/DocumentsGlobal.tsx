import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/store/AppStore';
import { PageHeader } from '@/components/layout/AppShell';
import { DocumentsView } from '@/components/documents/DocumentsView';
import { Card, Skeleton } from '@/components/ui/primitives';
import { useInitialLoad } from '@/lib/useLoading';

export default function DocumentsGlobal() {
  const { state } = useApp();
  const [params] = useSearchParams();
  const loading = useInitialLoad();

  if (loading) {
    return (
      <>
        <div className="mb-5"><Skeleton className="h-7 w-44" /></div>
        <Card className="p-5">
          <Skeleton className="h-4 w-52" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`${state.documents.length} files across every project, each one linked back to the step, register entry or invoice it belongs to.`}
      />
      <DocumentsView key={params.get('q') ?? ''} />
    </>
  );
}
