import { ProjectDetailPage } from "@/components/tenant-projects/projects-core";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <ProjectDetailPage projectId={params.id} />;
}
