import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGlobalState } from "@/hooks";
import { runLua } from "@/lib/ao-vars";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader } from "lucide-react";
import axios from "axios";
import Ansi from "ansi-to-react";
import { BUILDER_BACKEND } from "@/lib/utils";
import useDeploymentManager from "@/hooks/useDeploymentManager";

type Branch = {
    name: string
}

function Logs({ name, deploying }: { name: string; deploying?: boolean }) {
  const [output, setOutput] = useState("");

  useEffect(() => {
    if (!name) return;
    const interval: ReturnType<typeof setInterval> = setInterval(async () => {
      if (!deploying) return clearInterval(interval);
      const logs = await axios.get(`${BUILDER_BACKEND}/logs/${name}`);
      setOutput((logs.data as string).replaceAll(/\\|\||\-/g, ""));
      setTimeout(() => {
        const logsDiv = document.getElementById("logs");
        logsDiv?.scrollTo({ top: logsDiv.scrollHeight, behavior: "smooth" });
      }, 100);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [name, deploying]);

  return (
    <div>
      <div className="pl-2 mb-1">Build Logs</div>
      <pre className="font-mono text-xs border p-2 rounded-lg px-4 bg-black/30 overflow-scroll max-h-[250px]" id="logs">
        <Ansi className="!font-mono">{output}</Ansi>
      </pre>
    </div>
  );
}

export default function Deploy() {
  const router = useRouter();
  const { repo, installationId } = router.query;
  const globalState = useGlobalState();
  const { managerProcess, refresh } = useDeploymentManager();
  const [projName, setProjName] = useState("");
  const [installCommand, setInstallCommand] = useState("npm install");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDir, setOutputDir] = useState("./dist");
  const [deploying, setDeploying] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [loadingRepoDetails, setLoadingRepoDetails] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    if (repo) {
      fetchRepoDetails(repo as string);
    }
  }, [repo]);

  async function fetchRepoDetails(repoFullName: string) {
    setLoadingRepoDetails(true);
    try {
      const [owner, repoName] = repoFullName.split("/");
      const response = await axios.get(`${BUILDER_BACKEND}/github/repo-details/${owner}/${repoName}`);
      const { default_branch, buildCommand, installCommand, outputDir } = response.data;

      setProjName(repoName);
      setSelectedBranch(default_branch);
      setBuildCommand(buildCommand || "npm run build");
      setInstallCommand(installCommand || "npm ci");
      setOutputDir(outputDir || "./dist");
      fetchBranches(repoFullName);
    } catch (error: any) {
      console.error("Error fetching repo details:", error);
      toast.error(`Failed to fetch repository details: ${error.message}`);
    } finally {
      setLoadingRepoDetails(false);
    }
  }

  async function fetchBranches(repoFullName: string) {
    setLoadingBranches(true);
    const [owner, repo] = repoFullName.split("/");
    try {
        const response = await axios.get(`${BUILDER_BACKEND}/github/branches/${owner}/${repo}`);
        console.log("Branches:", response.data);
        setBranches(response.data);
    } catch (error) {
        console.error(error);
    } finally {
        setLoadingBranches(false);
    }
}

  async function deploy() {
    if (!projName) return toast.error("Project Name is required");
    if (!repo) return toast.error("Repository URL is required");
    if (!selectedBranch) return toast.error("Branch is required");
    if (!installCommand) return toast.error("Install Command is required");
    if (!buildCommand) return toast.error("Build Command is required");
    if (!outputDir) return toast.error("Output Directory is required");

    if (deploying) return;

    if (!globalState.managerProcess) return toast.error("Manager process not found");

    const repoUrl = `https://github.com/${repo}`;

    setDeploying(true);
    const query = `local res = db:exec[[
      INSERT INTO Deployments (Name, RepoUrl, Branch, InstallCMD, BuildCMD, OutputDIR)
      VALUES
      ('${projName}', '${repoUrl}', '${selectedBranch}', '${installCommand}', '${buildCommand}', '${outputDir}')
    ]]`;

    const res = await runLua(query, globalState.managerProcess);
    if (res.Error) return toast.error(res.Error);

    try {
      const txid = await axios.post(`${BUILDER_BACKEND}/deploy`, {
        repository: repoUrl,
        branch: selectedBranch,
        installCommand,
        buildCommand,
        outputDir,
        installationId,
      }, {
        timeout: 60 * 60 * 1000,
        headers: { "Content-Type": "application/json" },
      });

      if (txid.status === 200) {
        toast.success("Deployment successful");
      }
    } catch (error) {
      toast.error("Deployment failed");
    } finally {
      setDeploying(false);
    }
  }

  if (loadingRepoDetails) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-full">
          <Loader className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Deploy Project</h1>
        <Input
          placeholder="Project Name"
          value={projName}
          onChange={(e) => setProjName(e.target.value)}
        />
        <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={loadingBranches}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch: Branch) => (
              <SelectItem key={branch.name} value={branch.name}>
              {branch.name}
            </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Install Command"
          value={installCommand}
          onChange={(e) => setInstallCommand(e.target.value)}
        />
        <Input
          placeholder="Build Command"
          value={buildCommand}
          onChange={(e) => setBuildCommand(e.target.value)}
        />
        <Input
          placeholder="Output Directory"
          value={outputDir}
          onChange={(e) => setOutputDir(e.target.value)}
        />
        <div>
          <Button onClick={deploy} disabled={deploying}>
            {deploying ? <Loader className="animate-spin mr-2" /> : null}
            {deploying ? "Deploying..." : "Deploy"}
          </Button>
        </div>
        {deploying && <Logs name={projName} deploying={deploying} />}
      </div>
    </Layout>
  );
}