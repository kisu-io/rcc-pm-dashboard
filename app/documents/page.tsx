import { getDocuments, getProjects } from '@/lib/data-server';
import DocumentsDrive from '@/components/DocumentsDrive';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const [docs, projects] = await Promise.all([getDocuments(), getProjects()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Documents</h1>
        <p className="text-xs md:text-sm text-slate-500">Drive-type storage — drag-drop upload, preview, download</p>
      </div>
      <DocumentsDrive initialDocs={docs} projects={projects} />
    </div>
  );
}