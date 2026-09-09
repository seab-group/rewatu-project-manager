import { useParams } from 'react-router-dom';
import { useProject } from '@/store/AppStore';
import { DocumentsView } from '@/components/documents/DocumentsView';

export default function ProjectDocuments() {
  const { projectId } = useParams();
  const data = useProject(projectId);
  if (!data) return null;
  return <DocumentsView projectId={data.project.id} />;
}
