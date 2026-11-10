import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProject, formatBudget } from "@/hooks/use-projects";

const ProjectDetail = () => {
  const { id } = useParams();
  const { data: project, isLoading, isError } = useProject(id!);

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  if (isError || !project) {
    return (
      <div className="p-6">
        <p className="text-destructive">We couldn't find that project.</p>
        <Button asChild variant="link">
          <Link to="/dashboard">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const spent = Math.min(100, Math.round((project.spent / project.budget) * 100));

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        All projects
      </Link>
      <div>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="mt-1 text-muted-foreground">Budget: {formatBudget(project.budget)}</p>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Spent</span>
          <span>{spent}%</span>
        </div>
        <Progress value={spent} />
      </div>
    </div>
  );
};

export default ProjectDetail;
